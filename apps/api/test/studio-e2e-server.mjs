// Isolated test server. Never imported by the production application.
import "reflect-metadata";
import process from "node:process";
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
class TestModule {}
Module({
  controllers: [
    DirectorStudioController,
    StudioLibraryController,
    StudioSharesController,
    PerformanceProjectsController,
    PerformanceRequestsController,
  ],
  providers: [
    { provide: PrismaService, useValue: prisma },
    { provide: DirectorStudioService, useValue: studio },
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
async function close() {
  studio.onModuleDestroy();
  await prisma.client.performanceAssignment.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.client.user.deleteMany({
    where: { id: { in: [fixture.ownerId, fixture.actorUserId, fixture.otherUserId] } },
  });
  await app.close();
  process.exit(0);
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
