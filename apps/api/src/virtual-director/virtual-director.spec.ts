import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigService } from "@nestjs/config";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { StorageClient } from "../storage/storage.types.js";
import { VirtualDirectorService } from "./virtual-director.service.js";
import { VirtualDirectorWorker } from "./virtual-director.worker.js";
import { ProviderError, type VideoProvider } from "./video-provider.js";
import { inspectVideo, runVideoCommand } from "./video-processing.js";
const databaseUrl = process.env.STUDIO_TEST_DATABASE_URL;
test(
  "PostgreSQL: private references, immutable camera jobs, billing safeguards and worker recovery",
  { skip: !databaseUrl },
  async (suite) => {
    assert.match(
      databaseUrl!,
      /^postgres(?:ql)?:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/studio_test/,
    );
    const nonUtcUrl = new URL(databaseUrl!);
    nonUtcUrl.searchParams.set("options", "-c timezone=Europe/Paris");
    process.env.DATABASE_URL = nonUtcUrl.href;
    const prisma = new PrismaService();
    await prisma.onModuleInit();
    const ownerId = randomUUID(),
      otherId = randomUUID(),
      projectId = randomUUID();
    await prisma.client.user.createMany({
      data: [
        { id: ownerId, email: `${ownerId}@virtual.test`, role: "CLIENT" },
        { id: otherId, email: `${otherId}@virtual.test`, role: "CLIENT" },
      ],
    });
    await prisma.client.performanceProject.create({
      data: {
        id: projectId,
        ownerId,
        title: "Isolated virtual production",
        type: "Test",
        companyName: "Isolated test",
      },
    });
    const directory = await mkdtemp(join(tmpdir(), "vd-persistence-test-"));
    const binary = process.env.FFMPEG_PATH || "ffmpeg",
      probe = process.env.FFPROBE_PATH || "ffprobe",
      signal = AbortSignal.timeout(60000);
    const sourcePath = join(directory, "source.mp4");
    await runVideoCommand(
      binary,
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
        sourcePath,
      ],
      signal,
    );
    const source = await readFile(sourcePath);
    const outputPath = join(directory, "provider-fixture.mp4");
    await runVideoCommand(
      binary,
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
        outputPath,
      ],
      signal,
    );
    const generatedFixture = await readFile(outputPath);
    const objects = new Map<string, Uint8Array>();
    const storage: StorageClient = {
      createPresignedUpload: async () => {
        const key = `actor-private/virtual-director/${projectId}/incoming/${randomUUID()}.mp4`;
        return {
          key,
          bucket: "actor-private",
          path: key.split("/").slice(1).join("/"),
          method: "PUT",
          assetUrl: "DO_NOT_RETURN_PUBLIC_URL",
          uploadUrl: "http://test.invalid/private-upload",
        };
      },
      uploadObject: async (key, bytes) => {
        objects.set(key, bytes);
      },
      downloadObject: async (key) => {
        const bytes = objects.get(key);
        if (!bytes) throw new Error("Test object missing");
        return bytes;
      },
      getObjectInfo: async (key) => {
        const bytes = objects.get(key);
        if (!bytes) throw new Error("Test object missing");
        return { sizeBytes: bytes.byteLength, contentType: "video/mp4" };
      },
      createSignedReadUrl: async (key, _expires, options) =>
        `https://test.invalid/signed?asset=${encodeURIComponent(key)}${options?.downloadFileName ? "&download=1" : ""}`,
      deleteObject: async (key) => {
        objects.delete(key);
      },
      getPublicUrl: () => "DO_NOT_RETURN_PUBLIC_URL",
    };
    const config = new ConfigService({
      STORAGE_PROVIDER: "supabase",
      FAL_KEY: "test-key",
      VIRTUAL_DIRECTOR_CENTS_PER_SECOND: "10",
      VIRTUAL_DIRECTOR_MONTHLY_BUDGET_CENTS: "1000",
      FFMPEG_PATH: binary,
      FFPROBE_PATH: probe,
      BLENDER_PATH: "/nonexistent/test-blender",
    });
    const service = new VirtualDirectorService(prisma, storage, config);
    let submissions = 0,
      polls = 0,
      cancellations = 0,
      mode = "normal";
    const receipt = {
      request_id: "test-receipt",
      status_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/test-receipt/status",
      response_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/test-receipt",
      cancel_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/test-receipt/cancel",
    };
    let cancelDuringSubmit: (() => Promise<void>) | null = null;
    const provider: VideoProvider = {
      submit: async () => {
        submissions++;
        if (mode === "submission-failure") throw new TypeError("Lost network receipt");
        if (cancelDuringSubmit) await cancelDuringSubmit();
        return receipt;
      },
      poll: async () => {
        polls++;
        if (mode === "temporary-poll-failure")
          throw new ProviderError("Test transient outage", true);
        if (mode === "provider-rejection") throw new ProviderError("Test provider rejection");
        return { status: "COMPLETED", url: "https://v3b.fal.media/test-generated.mp4" };
      },
      cancel: async () => {
        cancellations++;
      },
    };
    const worker = new VirtualDirectorWorker(prisma, storage, config, provider);
    await worker.verifyRuntime();
    let state = await service.initialize(ownerId, projectId, { version: 0 });
    let referenceId = "",
      jobId = "";
    const rights = {
      performerName: "Isolated test performer",
      rightsBasis: "Synthetic test video only",
      ownsOrLicensed: true,
      aiTransformation: true,
      providerTransfer: true,
    };
    const request = () => ({
      version: state.version,
      kind: "GENERATE",
      shotId: state.scene!.shots[0]!.id,
      referenceId,
      requestKey: randomUUID(),
      maxCostCents: 50,
      sourceStartSeconds: 0,
    });
    async function due(id: string) {
      await prisma.client.virtualDirectorJob.update({
        where: { id },
        data: { nextRunAt: new Date(0), leaseUntil: null },
      });
    }
    const originalFetch = globalThis.fetch;
    try {
      await suite.test("owner-only access and optimistic camera saves", async () => {
        await assert.rejects(service.get(otherId, projectId), NotFoundException);
        assert.equal(state.capabilities.generationReady, true);
        const writes = await Promise.allSettled([
          service.save(ownerId, projectId, {
            version: state.version,
            scene: { ...state.scene!, title: "First camera save" },
          }),
          service.save(ownerId, projectId, {
            version: state.version,
            scene: { ...state.scene!, title: "Concurrent save" },
          }),
        ]);
        assert.equal(writes.filter((result) => result.status === "fulfilled").length, 1);
        state = await service.get(ownerId, projectId);
        const rls = await prisma.client.$queryRaw<
          { relrowsecurity: boolean }[]
        >`SELECT relrowsecurity FROM pg_class WHERE relname IN ('VirtualDirector','VirtualDirectorReference','VirtualDirectorJob','VirtualDirectorWorker')`;
        assert.equal(rls.length, 4);
        assert.ok(rls.every((row) => row.relrowsecurity));
      });
      await suite.test(
        "uploaded bytes are verified and inspected, then copied to private immutable storage",
        async () => {
          const reservation = await service.reserve(ownerId, projectId, {
            name: "test-only.mp4",
            contentType: "video/mp4",
            sizeBytes: source.length,
            rights,
          });
          referenceId = reservation.referenceId;
          assert.equal(JSON.stringify(reservation).includes("DO_NOT_RETURN_PUBLIC_URL"), false);
          const reference = await prisma.client.virtualDirectorReference.findUniqueOrThrow({
            where: { id: referenceId },
          });
          objects.set(reference.storageKey, source);
          await service.completeUpload(ownerId, projectId, referenceId);
          await worker.tick();
          state = await service.get(ownerId, projectId);
          assert.equal(state.references[0]!.status, "READY");
          assert.equal(state.references[0]!.hasAudio, true);
          assert.ok(state.references[0]!.duration! >= 6);
          assert.equal(JSON.stringify(state).includes("storageKey"), false);
          assert.equal(JSON.stringify(state).includes("actor-private/"), false);
        },
      );
      await suite.test(
        "idempotency, duplicate shot exclusion, estimates and immutable snapshots",
        async () => {
          await assert.rejects(
            service.enqueue(ownerId, projectId, { ...request(), maxCostCents: 1 }),
            ConflictException,
          );
          await assert.rejects(
            service.enqueue(ownerId, projectId, { ...request(), version: 0 }),
            ConflictException,
          );
          const payload = request();
          await Promise.all([
            service.enqueue(ownerId, projectId, payload),
            service.enqueue(ownerId, projectId, payload),
          ]);
          assert.equal(
            await prisma.client.virtualDirectorJob.count({
              where: { projectId, kind: "GENERATE" },
            }),
            1,
          );
          state = await service.get(ownerId, projectId);
          jobId = state.jobs.find((job) => job.kind === "GENERATE")!.id;
          await assert.rejects(service.enqueue(ownerId, projectId, request()), ConflictException);
          const snapshot = await prisma.client.virtualDirectorJob.findUniqueOrThrow({
            where: { id: jobId },
          });
          const changed = structuredClone(state.scene!);
          changed.shots[0]!.name = "Changed after queueing";
          state = await service.save(ownerId, projectId, {
            version: state.version,
            scene: changed,
          });
          assert.equal((snapshot.input as { shot: { name: string } }).shot.name, "Medium shot");
        },
      );
      await suite.test(
        "durable provider receipt survives worker restart and a transient polling failure",
        async () => {
          await prisma.client.virtualDirectorJob.update({
            where: { id: jobId },
            data: { token: randomUUID(), leaseUntil: new Date(Date.now() + 30000) },
          });
          assert.equal(
            await worker.tick(),
            false,
            "A future UTC lease cannot be claimed in a non-UTC database session",
          );
          await prisma.client.virtualDirectorJob.update({
            where: { id: jobId },
            data: { token: null, leaseUntil: null },
          });
          await worker.tick();
          assert.equal(submissions, 1);
          assert.equal(
            (await prisma.client.virtualDirectorJob.findUniqueOrThrow({ where: { id: jobId } }))
              .status,
            "WAITING_PROVIDER",
          );
          const beforePoll = polls;
          assert.equal(await worker.tick(), false, "A future UTC poll must stay pending");
          assert.equal(polls, beforePoll);
          mode = "temporary-poll-failure";
          await due(jobId);
          await new VirtualDirectorWorker(prisma, storage, config, provider).tick();
          const job = await prisma.client.virtualDirectorJob.findUniqueOrThrow({
            where: { id: jobId },
          });
          assert.equal(job.status, "WAITING_PROVIDER");
          assert.equal(job.failures, 1);
          assert.equal(submissions, 1);
          mode = "normal";
          await due(jobId);
          globalThis.fetch = (async () =>
            new Response(generatedFixture, {
              headers: { "Content-Type": "video/mp4" },
            })) as typeof fetch;
          await worker.tick();
          state = await service.get(ownerId, projectId);
          const completed = await prisma.client.virtualDirectorJob.findUniqueOrThrow({
            where: { id: jobId },
          });
          assert.equal(completed.status, "COMPLETED");
          assert.ok(completed.outputKey);
          const path = join(directory, "persisted-final.mp4");
          const { writeFile } = await import("node:fs/promises");
          await writeFile(path, objects.get(completed.outputKey!)!);
          const metadata = await inspectVideo(path, probe, signal);
          assert.equal(metadata.hasAudio, true);
          assert.ok(Math.abs(metadata.duration - 5) < 0.2);
          assert.equal(submissions, 1);
          assert.equal(polls, 2);
        },
      );
      await suite.test(
        "review playback is private and final download requires approval",
        async () => {
          await assert.rejects(service.media(otherId, projectId, jobId, "job"), NotFoundException);
          await assert.rejects(
            service.media(ownerId, projectId, jobId, "job", true),
            ConflictException,
          );
          assert.equal(
            (await service.media(ownerId, projectId, jobId, "job")).expiresInSeconds,
            300,
          );
          await service.approve(ownerId, projectId, jobId);
          assert.match(
            (await service.media(ownerId, projectId, jobId, "job", true)).url,
            /download=1/,
          );
        },
      );
      await suite.test(
        "monthly reserved budget covers failed attempts, and enforces limits",
        async () => {
          const restricted = new VirtualDirectorService(
            prisma,
            storage,
            new ConfigService({
              STORAGE_PROVIDER: "supabase",
              FAL_KEY: "test-key",
              VIRTUAL_DIRECTOR_CENTS_PER_SECOND: "10",
              VIRTUAL_DIRECTOR_MONTHLY_BUDGET_CENTS: "50",
            }),
          );
          await assert.rejects(restricted.enqueue(ownerId, projectId, request()), /Monthly/);
        },
      );
      await suite.test(
        "provider refusal fails the shot without any substitute result",
        async () => {
          state = await service.enqueue(ownerId, projectId, request());
          const id = state.jobs.find((job) => job.status === "QUEUED")!.id;
          await worker.tick();
          mode = "provider-rejection";
          await due(id);
          await worker.tick();
          mode = "normal";
          const job = await prisma.client.virtualDirectorJob.findUniqueOrThrow({ where: { id } });
          assert.equal(job.status, "FAILED");
          assert.equal(job.outputKey, null);
          assert.match(job.error!, /rejection/);
        },
      );
      await suite.test(
        "uncertain submission is never automatically billed a second time",
        async () => {
          state = await service.enqueue(ownerId, projectId, request());
          const id = state.jobs.find((job) => job.status === "QUEUED")!.id;
          mode = "submission-failure";
          const before = submissions;
          await worker.tick();
          mode = "normal";
          await worker.tick();
          assert.equal(submissions, before + 1);
          const job = await prisma.client.virtualDirectorJob.findUniqueOrThrow({ where: { id } });
          assert.equal(job.status, "FAILED");
          assert.equal(job.stage, "SUBMISSION_UNCERTAIN");
          assert.equal(job.outputKey, null);
          state = await service.enqueue(ownerId, projectId, request());
          const interrupted = state.jobs.find((job) => job.status === "QUEUED")!.id;
          await prisma.client.virtualDirectorJob.update({
            where: { id: interrupted },
            data: { status: "SUBMITTING", leaseUntil: new Date(0) },
          });
          const count = submissions;
          await worker.tick();
          assert.equal(submissions, count);
          assert.equal(
            (
              await prisma.client.virtualDirectorJob.findUniqueOrThrow({
                where: { id: interrupted },
              })
            ).status,
            "FAILED",
          );
        },
      );
      await suite.test(
        "cancellation during submission saves the receipt for provider cancellation",
        async () => {
          state = await service.enqueue(ownerId, projectId, request());
          const id = state.jobs.find((job) => job.status === "QUEUED")!.id;
          cancelDuringSubmit = async () => {
            await service.cancel(ownerId, projectId, id);
          };
          await worker.tick();
          cancelDuringSubmit = null;
          const job = await prisma.client.virtualDirectorJob.findUniqueOrThrow({ where: { id } });
          assert.equal(job.status, "CANCELLED");
          assert.ok(job.providerRequest);
          const before = cancellations;
          await worker.tick();
          assert.ok(cancellations > before);
          assert.equal(
            (await prisma.client.virtualDirectorJob.findUniqueOrThrow({ where: { id } })).outputKey,
            null,
          );
        },
      );
      await suite.test(
        "existing performance import requires consent allowing AI transformation",
        async () => {
          const scene = await prisma.client.performanceScene.create({
            data: { projectId, position: 0, title: "Test performance" },
          });
          const take = await prisma.client.performanceTake.create({
            data: {
              projectId,
              sceneId: scene.id,
              uploadAttemptId: randomUUID(),
              originalFileName: "approved-test.mp4",
              contentType: "video/mp4",
              sizeBytes: source.length,
              storageBucket: "actor-private",
              storagePath: "existing-test.mp4",
              uploadStatus: "UPLOADED",
              takeStatus: "QA_PASSED",
            },
          });
          objects.set("actor-private/existing-test.mp4", source);
          await assert.rejects(
            service.importTake(ownerId, projectId, { takeId: take.id, rights }),
            /accepted consent/,
          );
          await prisma.client.performanceBrief.create({
            data: {
              projectId,
              talentRequirements: {},
              capturePlan: {},
              globalDirection: "Test",
              qaCriteria: {},
              model: "test",
              version: 1,
              approvedVersion: 1,
              approvedAt: new Date(),
            },
          });
          await prisma.client.performanceConsent.create({
            data: {
              projectId,
              version: 1,
              approvedBriefVersion: 1,
              aiTransformationAllowed: false,
              acceptedAt: new Date(),
            },
          });
          await assert.rejects(
            service.importTake(ownerId, projectId, { takeId: take.id, rights }),
            /accepted consent/,
          );
          await prisma.client.performanceConsent.updateMany({
            where: { projectId },
            data: { aiTransformationAllowed: true },
          });
          const imported = await service.importTake(ownerId, projectId, {
            takeId: take.id,
            rights,
          });
          assert.equal(imported.references.length, 2);
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      await prisma.client.performanceProject.delete({ where: { id: projectId } });
      await prisma.client.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
      await prisma.onModuleDestroy();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
