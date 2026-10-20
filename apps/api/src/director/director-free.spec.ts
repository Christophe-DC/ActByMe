import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigService } from "@nestjs/config";
import { UserRole, createDirectorShot } from "@actbyme/shared";
import { PrismaService } from "../database/prisma.service.js";
import type { StorageClient } from "../storage/storage.types.js";
import { runVideoCommand } from "../virtual-director/video-processing.js";
import { DirectorService } from "./director.service.js";
import { DirectorProviders } from "./director-providers.js";
import { DirectorInspectionService } from "./director-inspection.service.js";
import { DirectorWorker } from "./director.worker.js";

const databaseUrl = process.env.STUDIO_TEST_DATABASE_URL;
test(
  "free Director persists verified browser results without a dedicated worker or paid provider",
  { skip: !databaseUrl, timeout: 60000 },
  async () => {
    assert.match(
      databaseUrl!,
      /^postgres(?:ql)?:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/studio_test/,
    );
    process.env.DATABASE_URL = databaseUrl!;
    const prisma = new PrismaService();
    await prisma.onModuleInit();
    const directory = await mkdtemp(join(tmpdir(), "director-free-"));
    const owner = {
      id: randomUUID(),
      email: `${randomUUID()}@director.test`,
      role: UserRole.Client,
    };
    const other = {
      id: randomUUID(),
      email: `${randomUUID()}@director.test`,
      role: UserRole.Client,
    };
    const objects = new Map<string, Uint8Array>();
    const storage: StorageClient = {
      createPresignedUpload: async (input) => ({
        key: `actor-private/${input.pathPrefix}/${randomUUID()}.mp4`,
        bucket: "actor-private",
        path: "test",
        method: "PUT",
        assetUrl: "DO_NOT_EXPOSE",
        uploadUrl: "https://test.invalid",
      }),
      getObjectInfo: async (key) => ({
        sizeBytes: objects.get(key)?.length,
        contentType: "video/mp4",
      }),
      downloadObject: async (key) => {
        const bytes = objects.get(key);
        if (!bytes) throw new Error("Missing");
        return bytes;
      },
      deleteObject: async (key) => {
        objects.delete(key);
      },
      createSignedReadUrl: async () => "https://test.invalid/signed",
      getPublicUrl: () => "DO_NOT_EXPOSE",
    };
    // Default configuration, even with a provider key: paid processing is locked.
    const config = new ConfigService({
      STORAGE_PROVIDER: "supabase",
      DIRECTOR_VEO_API_KEY: "unused-test-only",
      DIRECTOR_VEO_CENTS_PER_SECOND: "10",
    });
    const providers = new DirectorProviders(config),
      service = new DirectorService(prisma, storage, config, providers);
    const inspection = new DirectorInspectionService(prisma, storage, config);
    try {
      const path = join(directory, "result.mp4");
      await runVideoCommand(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=c=blue:s=1280x720:r=24:d=2",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=500:duration=2",
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-y",
          path,
        ],
        AbortSignal.timeout(10000),
      );
      const bytes = await readFile(path);
      let state = await service.create(owner, { title: "Free browser workflow", demo: false });
      const otherState = await service.create(other, {
        title: "Other isolated owner",
        demo: false,
      });
      assert.equal(state.capabilities.browserExportReady, true);
      assert.ok(
        state.capabilities.providers.every(
          (provider) => !provider.ready && provider.reason?.includes("disabled"),
        ),
      );
      const upload = async (projectId: string, userId: string, payload = bytes) => {
        const reservation = await service.reserve(userId, projectId, {
          name: "result.mp4",
          kind: "clip",
          contentType: "video/mp4",
          sizeBytes: payload.length,
          rightsBasis: "Synthetic fixture; no real actor.",
          rightsConfirmed: true,
          aiTransferAllowed: false,
        });
        const asset = await prisma.client.directorAsset.findUniqueOrThrow({
          where: { id: reservation.assetId },
        });
        objects.set(asset.storageKey, payload);
        await service.completeUpload(userId, projectId, asset.id);
        // Real API-only inspection, with no DirectorWorker heartbeat or native ffprobe.
        for (let count = 0; count < 10; count++) {
          if (
            (await prisma.client.directorAsset.findUniqueOrThrow({ where: { id: asset.id } }))
              .status !== "INSPECTING"
          )
            break;
          await inspection.tick();
        }
        return asset.id;
      };
      const source = await upload(state.id, owner.id);
      state.document.shots = [
        { ...createDirectorShot("dolly-in", "first", 2), clipAssetId: source },
      ];
      state = await service.save(owner.id, state.id, {
        version: state.version,
        document: state.document,
      });
      const input = {
        kind: "EXPORT",
        execution: "browser",
        version: state.version,
        requestKey: randomUUID(),
        maxCostCents: 0,
        confirmRights: true,
      };
      state = await service.enqueue(owner.id, state.id, input);
      const job = state.jobs.find((job) => job.kind === "EXPORT")!;
      assert.equal(job.estimatedCostCents, 0);
      assert.equal(
        (await service.enqueue(owner.id, state.id, input)).jobs.length,
        state.jobs.length,
      );
      await assert.rejects(
        service.enqueue(owner.id, state.id, { ...input, requestKey: randomUUID() }),
        /already active/,
      );
      const nativeWorker = new DirectorWorker(prisma, storage, config, providers, service);
      // Any optional native worker must leave a browser job alone.
      assert.equal(await nativeWorker.tick(AbortSignal.timeout(10000)), false);
      await assert.rejects(
        service.completeBrowserExport(owner.id, state.id, job.id, { assetId: source }),
        /must be verified/,
      );
      const foreign = await upload(otherState.id, other.id);
      await assert.rejects(
        service.completeBrowserExport(owner.id, state.id, job.id, { assetId: foreign }),
        /must be verified/,
      );
      await assert.rejects(
        service.completeBrowserExport(other.id, state.id, job.id, { assetId: source }),
        /not found/,
      );
      const output = await upload(state.id, owner.id);
      state.document.shots[0]!.waypoints[0]!.position.y = 3;
      const edited = await service.save(owner.id, state.id, {
        version: state.version,
        document: state.document,
      });
      const completed = await service.completeBrowserExport(owner.id, state.id, job.id, {
        assetId: output,
      });
      assert.equal(completed.version, edited.version);
      assert.equal(completed.jobs.find((item) => item.id === job.id)?.version, input.version);
      assert.equal(completed.jobs.find((item) => item.id === job.id)?.status, "SUCCEEDED");
      await service.completeBrowserExport(owner.id, state.id, job.id, { assetId: output });
      const next = await service.enqueue(owner.id, state.id, {
        ...input,
        requestKey: randomUUID(),
        version: completed.version,
      });
      const nextJob = next.jobs.find(
        (item) => item.kind === "EXPORT" && item.status === "PROCESSING",
      )!;
      await service.cancel(owner.id, state.id, nextJob.id);
      await assert.rejects(
        service.completeBrowserExport(owner.id, state.id, nextJob.id, { assetId: output }),
        /completed or cancelled/,
      );
      const malformed = await upload(state.id, owner.id, Buffer.from("fake MP4"));
      assert.equal(
        (await service.get(owner.id, state.id)).assets.find((asset) => asset.id === malformed)
          ?.status,
        "FAILED",
      );
    } finally {
      await inspection.onModuleDestroy();
      await prisma.client.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
      await prisma.onModuleDestroy();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
