// Isolated test server. Never imported by the production application.
import "reflect-metadata";
import process from "node:process";
import { Buffer } from "node:buffer";
import console from "node:console";
import { setInterval, clearInterval } from "node:timers";
const { AbortController, AbortSignal, Request, Response } = globalThis;
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { VirtualDirectorService } from "../dist/virtual-director/virtual-director.service.js";
import { VirtualDirectorController } from "../dist/virtual-director/virtual-director.controller.js";
import { VirtualDirectorWorker } from "../dist/virtual-director/virtual-director.worker.js";
import { ProviderError } from "../dist/virtual-director/video-provider.js";
import { runVideoCommand } from "../dist/virtual-director/video-processing.js";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import express from "express";
import { PrismaService } from "../dist/database/prisma.service.js";
import { DirectorStudioService } from "../dist/director-studio/director-studio.service.js";
import {
  StudioLibraryController,
  StudioSharesController,
} from "../dist/director-studio/studio-library.controller.js";
import { DirectorStudioController } from "../dist/director-studio/director-studio.controller.js";
import { createStudioFixture, fixtureGemini } from "../dist/director-studio/studio-fixtures.js";
import { PerformanceProjectsService } from "../dist/performance-projects/performance-projects.service.js";
import { PerformanceProjectsController } from "../dist/performance-projects/performance-projects.controller.js";
import { PerformanceRequestsController } from "../dist/performance-projects/performance-requests.controller.js";
import { DirectorController } from "../dist/director/director.controller.js";
import { DirectorService } from "../dist/director/director.service.js";
import { DirectorProviders } from "../dist/director/director-providers.js";
import { DirectorWorker } from "../dist/director/director.worker.js";
import { DirectorInspectionService } from "../dist/director/director-inspection.service.js";
import { RolesGuard } from "../dist/auth/roles.guard.js";
import { SupabaseService } from "../dist/supabase/supabase.service.js";

if (!process.env.STUDIO_TEST_DATABASE_URL?.match(/(?:localhost|127\.0\.0\.1).*studio_test/))
  throw new Error("Use an isolated local studio_test database.");
process.env.DATABASE_URL = process.env.STUDIO_TEST_DATABASE_URL;
const prisma = new PrismaService();
const fixture = await createStudioFixture(prisma);
let assistantMode = "normal";
const studio = new DirectorStudioService(prisma, {
  generate: (request) =>
    assistantMode === "invalid"
      ? Promise.resolve({ outputText: "{}", model: "invalid-fixture", responseId: null })
      : fixtureGemini.generate(request),
});
let qaInput = null;
const storage = {
  createPresignedUpload: async () => ({
    bucket: "actor-private",
    path: "test-take.mp4",
    key: "actor-private/test-take.mp4",
    uploadUrl: "http://127.0.0.1:4401/test-upload",
    token: "test-token",
    method: "PUT",
  }),
  getObjectInfo: async () => ({ contentType: "video/mp4", sizeBytes: 100 }),
  createSignedReadUrl: async () => "http://127.0.0.1:4401/test-upload",
  deleteObject: async () => undefined,
};
const qa = {
  evaluate: async (input) => {
    qaInput = input;
    return {
      checks: [
        {
          type: "DURATION",
          result: "PASS",
          requiredValue: { seconds: 24 },
          measuredValue: { seconds: 24 },
          correctionInstruction: null,
        },
      ],
      transcript: "Tu es venu.",
      transcriptionModel: "fixture",
    };
  },
};
const projects = new PerformanceProjectsService(prisma, storage, {}, {}, qa, {
  send: async () => ({ sent: false }),
});
// These synthetic files and the simulated video provider exist only in this test harness.
const virtualDirectory = await mkdtemp(join(tmpdir(), "actbyme-browser-video-"));
const fixtureVideoPath = join(virtualDirectory, "synthetic-reference.mp4");
const fixtureResultPath = join(virtualDirectory, "synthetic-provider-result.mp4");
await runVideoCommand(
  "ffmpeg",
  [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=320x240:r=24:d=6",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=6",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    "-y",
    fixtureVideoPath,
  ],
  AbortSignal.timeout(30000),
);
await runVideoCommand(
  "ffmpeg",
  [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=640x360:r=24:d=5",
    "-c:v",
    "libx264",
    "-an",
    "-y",
    fixtureResultPath,
  ],
  AbortSignal.timeout(30000),
);
const fixtureVideo = await readFile(fixtureVideoPath);
const fixtureResult = await readFile(fixtureResultPath);
const virtualObjects = new Map();
const virtualStorage = {
  createPresignedUpload: async () => {
    const path = `virtual-director/browser-test/${randomUUID()}.mp4`;
    const key = `actor-private/${path}`;
    return {
      key,
      path,
      bucket: "actor-private",
      assetUrl: "test-only",
      method: "PUT",
      uploadUrl: `http://127.0.0.1:4401/test-virtual-upload?key=${encodeURIComponent(key)}`,
    };
  },
  uploadObject: async (key, bytes) => {
    virtualObjects.set(key, Buffer.from(bytes));
  },
  downloadObject: async (key) => {
    if (!virtualObjects.has(key)) throw new Error("Fixture object missing");
    return virtualObjects.get(key);
  },
  getObjectInfo: async (key) => {
    if (!virtualObjects.has(key)) throw new Error("Fixture object missing");
    return { contentType: "video/mp4", sizeBytes: virtualObjects.get(key).length };
  },
  createSignedReadUrl: async (key) =>
    `http://127.0.0.1:4401/test-virtual-media?key=${encodeURIComponent(key)}`,
  deleteObject: async (key) => {
    virtualObjects.delete(key);
  },
  getPublicUrl: () => "test-only",
};
const virtualConfig = new ConfigService({
  STORAGE_PROVIDER: "supabase",
  FAL_KEY: "test-only",
  VIRTUAL_DIRECTOR_CENTS_PER_SECOND: "10",
  VIRTUAL_DIRECTOR_MONTHLY_BUDGET_CENTS: "1000",
  BLENDER_PATH: "/nonexistent/test-blender",
});
const virtualDirector = new VirtualDirectorService(prisma, virtualStorage, virtualConfig);
let virtualProviderMode = "normal";
const virtualProvider = {
  submit: async () => ({
    request_id: "browser-test",
    status_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/browser-test/status",
    response_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/browser-test",
    cancel_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/browser-test/cancel",
  }),
  poll: async () => {
    if (virtualProviderMode === "failure")
      throw new ProviderError("Simulated provider failure for browser regression test");
    return { status: "COMPLETED", url: "https://v3b.fal.media/browser-test.mp4" };
  },
  cancel: async () => undefined,
};
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) =>
  String(url) === "https://v3b.fal.media/browser-test.mp4"
    ? Promise.resolve(new Response(fixtureResult, { headers: { "Content-Type": "video/mp4" } }))
    : nativeFetch(url, options);
const virtualWorker = new VirtualDirectorWorker(
  prisma,
  virtualStorage,
  virtualConfig,
  virtualProvider,
);
await virtualWorker.verifyRuntime();
const virtualControl = new AbortController();
let virtualTask = Promise.resolve();
let virtualTickBusy = false;
const virtualTimer = setInterval(() => {
  if (virtualTickBusy) return;
  virtualTickBusy = true;
  virtualTask = virtualWorker
    .heartbeat()
    .then(() => virtualWorker.tick(virtualControl.signal))
    .catch((error) => console.error("Test video worker:", error.message))
    .finally(() => {
      virtualTickBusy = false;
    });
}, 500);

// Director uses the real HTTP service, database, media inspector and FFmpeg renderer.
// Only authentication, storage transport and billable generation are test fixtures.
const directorObjects = new Map();
const directorStorage = {
  createPresignedUpload: async (input) => {
    const path = `${input.pathPrefix}/${randomUUID()}.media`,
      key = `actor-private/${path}`;
    return {
      key,
      path,
      bucket: "actor-private",
      assetUrl: "TEST_ONLY",
      method: "PUT",
      uploadUrl: `http://127.0.0.1:4401/test-director-upload?key=${encodeURIComponent(key)}`,
    };
  },
  uploadObject: async (key, bytes, contentType) => {
    directorObjects.set(key, { bytes: Buffer.from(bytes), contentType });
  },
  downloadObject: async (key) => {
    if (!directorObjects.has(key)) throw new Error("Test asset missing");
    return directorObjects.get(key).bytes;
  },
  getObjectInfo: async (key) => {
    const object = directorObjects.get(key);
    if (!object) throw new Error("Test asset missing");
    return { contentType: object.contentType, sizeBytes: object.bytes.length };
  },
  createSignedReadUrl: async (key) =>
    `http://127.0.0.1:4401/test-director-media?key=${encodeURIComponent(key)}`,
  deleteObject: async (key) => {
    directorObjects.delete(key);
  },
  getPublicUrl: () => "TEST_ONLY",
};
const directorSourcePath = join(virtualDirectory, "director-source.mp4"),
  directorMusicPath = join(virtualDirectory, "director-music.wav"),
  directorImagePath = join(virtualDirectory, "director-image.png");
await runVideoCommand(
  "ffmpeg",
  [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=teal:s=640x360:r=24:d=8",
    "-c:v",
    "libx264",
    "-an",
    "-y",
    directorSourcePath,
  ],
  AbortSignal.timeout(30000),
);
await runVideoCommand(
  "ffmpeg",
  [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=500:duration=20",
    "-c:a",
    "pcm_s16le",
    "-y",
    directorMusicPath,
  ],
  AbortSignal.timeout(30000),
);
await runVideoCommand(
  "ffmpeg",
  [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=orange:s=128x128",
    "-frames:v",
    "1",
    "-y",
    directorImagePath,
  ],
  AbortSignal.timeout(30000),
);
const directorSource = await readFile(directorSourcePath),
  directorMusic = await readFile(directorMusicPath),
  directorImage = await readFile(directorImagePath);
const directorConfig = new ConfigService({
  STORAGE_PROVIDER: "supabase",
  DIRECTOR_ENABLE_PAID_GENERATION: "true",
  DIRECTOR_VEO_API_KEY: "browser-test-only",
  DIRECTOR_VEO_CENTS_PER_SECOND: "10",
  DIRECTOR_MONTHLY_BUDGET_CENTS: "1000",
});
class TestDirectorProviders extends DirectorProviders {
  async submit() {
    return { id: "models/veo-3.1-generate-preview/operations/browser_test_only" };
  }
  async poll() {
    return { done: true, url: "https://test.invalid/browser-only-result" };
  }
  async download() {
    return directorSource;
  }
}
const directorProviders = new TestDirectorProviders(directorConfig),
  director = new DirectorService(prisma, directorStorage, directorConfig, directorProviders),
  directorWorker = new DirectorWorker(
    prisma,
    directorStorage,
    directorConfig,
    directorProviders,
    director,
  );
const directorInspection = new DirectorInspectionService(prisma, directorStorage, directorConfig);
let nativeDirectorEnabled = false;
let directorTickBusy = false,
  directorTask = Promise.resolve();
const directorTimer = setInterval(() => {
  if (!nativeDirectorEnabled || directorTickBusy) return;
  directorTickBusy = true;
  directorTask = directorWorker
    .heartbeat()
    .then(() => directorWorker.tick(virtualControl.signal))
    .catch((error) => console.error("Test Director worker:", error.message))
    .finally(() => {
      directorTickBusy = false;
    });
}, 250);
class TestModule {}
Module({
  controllers: [
    DirectorStudioController,
    VirtualDirectorController,
    StudioLibraryController,
    StudioSharesController,
    PerformanceProjectsController,
    PerformanceRequestsController,
    DirectorController,
  ],
  providers: [
    { provide: PrismaService, useValue: prisma },
    { provide: DirectorStudioService, useValue: studio },
    { provide: VirtualDirectorService, useValue: virtualDirector },
    { provide: DirectorService, useValue: director },
    { provide: DirectorInspectionService, useValue: directorInspection },
    { provide: PerformanceProjectsService, useValue: projects },
    {
      provide: SupabaseService,
      useValue: { admin: { auth: { getUser: async () => ({ error: true }) } } },
    },
    RolesGuard,
  ],
})(TestModule);
const app = await NestFactory.create(TestModule, { logger: ["error", "warn"] });
app.useBodyParser("json", { limit: "1mb" });
app.enableCors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "content-type",
    "authorization",
    "x-user-id",
    "x-user-role",
    "x-upsert",
    "apikey",
  ],
});
app.use((request, _response, next) => {
  const id = request.headers["x-user-id"];
  if ([fixture.ownerId, fixture.actorUserId, fixture.otherUserId].includes(id))
    request.user = { id, role: id === fixture.actorUserId ? "ACTOR" : "CLIENT" };
  next();
});
app.use(
  "/test-director-upload",
  express.raw({ type: "*/*", limit: "20mb" }),
  async (request, response) => {
    const form = await new Request("http://test.invalid", {
      method: "POST",
      headers: { "content-type": request.headers["content-type"] },
      body: request.body,
    }).formData();
    const file = form.get("");
    if (!file || typeof file.arrayBuffer !== "function")
      return response.status(400).json({ message: "Test upload missing" });
    directorObjects.set(request.query.key, {
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    response.json({ Key: request.query.key });
  },
);
app.use("/test-director-media", (request, response) => {
  const object = directorObjects.get(request.query.key);
  if (!object) return response.status(404).end();
  response.type(object.contentType).send(object.bytes);
});
app.use("/test-director-worker", async (request, response) => {
  nativeDirectorEnabled = request.body?.enabled === true;
  if (nativeDirectorEnabled) await directorWorker.verifyRuntime();
  response.json({ enabled: nativeDirectorEnabled });
});
app.use("/test-director-source", (request, response) => {
  const kind = request.query.kind;
  response
    .type(kind === "image" ? "image/png" : kind === "music" ? "audio/wav" : "video/mp4")
    .send(kind === "image" ? directorImage : kind === "music" ? directorMusic : directorSource);
});
app.use(
  "/test-virtual-upload",
  express.raw({ type: "*/*", limit: "10mb" }),
  async (request, response) => {
    const form = await new Request("http://test.invalid", {
      method: "POST",
      headers: { "content-type": request.headers["content-type"] },
      body: request.body,
    }).formData();
    const file = form.get("");
    if (!file || typeof file.arrayBuffer !== "function")
      return response.status(400).json({ message: "Test upload missing" });
    virtualObjects.set(request.query.key, Buffer.from(await file.arrayBuffer()));
    response.json({ Key: request.query.key });
  },
);
app.use("/test-virtual-media", (request, response) => {
  const bytes = virtualObjects.get(request.query.key);
  if (!bytes) return response.status(404).end();
  response.type("video/mp4").send(bytes);
});
app.use("/test-virtual-source", (_request, response) =>
  response.type("video/mp4").send(fixtureVideo),
);
app.use("/test-virtual-mode", (request, response) => {
  virtualProviderMode = request.body?.mode ?? "normal";
  response.json({ mode: virtualProviderMode });
});
app.use("/test-virtual-fixture", async (_request, response) => {
  const project = await prisma.client.performanceProject.create({
    data: {
      ownerId: fixture.ownerId,
      title: "Synthetic browser production",
      type: "Test",
      companyName: "Isolated fixture",
    },
  });
  response.json({
    projectId: project.id,
    ownerId: fixture.ownerId,
    otherUserId: fixture.otherUserId,
  });
});
app.use("/test-upload", express.raw({ type: "*/*" }), (_request, response) =>
  response.status(200).json({ Key: "actor-private/test-take.mp4" }),
);
app.use("/test-assistant-mode", (request, response) => {
  assistantMode = request.body?.mode ?? "normal";
  response.json({ mode: assistantMode });
});
app.use("/test-qa-input", (_request, response) => response.json(qaInput));
app.use("/test-fixture", (_request, response) => response.json(fixture));
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
);
await app.listen(4401, "127.0.0.1");
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(virtualTimer);
  clearInterval(directorTimer);
  virtualControl.abort();
  await virtualTask.catch(() => undefined);
  await directorTask.catch(() => undefined);
  studio.onModuleDestroy();
  await rm(virtualDirectory, { recursive: true, force: true });
  await prisma.client.virtualDirectorJob.deleteMany({
    where: { project: { ownerId: { in: [fixture.ownerId, fixture.otherUserId] } } },
  });
  await prisma.client.performanceAssignment.deleteMany({
    where: {
      OR: [
        { project: { ownerId: { in: [fixture.ownerId, fixture.otherUserId] } } },
        { actorProfile: { userId: fixture.actorUserId } },
      ],
    },
  });
  await prisma.client.user.deleteMany({
    where: { id: { in: [fixture.ownerId, fixture.actorUserId, fixture.otherUserId] } },
  });
  await app.close();
  process.exit(0);
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
