import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigService } from "@nestjs/config";
import { UserRole, createDirectorShot } from "@actbyme/shared";
import type { StorageClient } from "../storage/storage.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { DirectorService, directorConsentScope } from "./director.service.js";
import { DirectorProviders, DirectorProviderError } from "./director-providers.js";
import { DirectorWorker } from "./director.worker.js";
import { runVideoCommand } from "../virtual-director/video-processing.js";
import { inspectDirectorAsset } from "./director-render.js";
const databaseUrl = process.env.STUDIO_TEST_DATABASE_URL;
test(
  "PostgreSQL Director: complete private project, assets, consent, queued generation and export lifecycle",
  { skip: !databaseUrl, timeout: 120000 },
  async (suite) => {
    assert.match(
      databaseUrl!,
      /^postgres(?:ql)?:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/studio_test/,
    );
    const nonUtc = new URL(databaseUrl!);
    nonUtc.searchParams.set("options", "-c timezone=Europe/Paris");
    process.env.DATABASE_URL = nonUtc.href;
    const prisma = new PrismaService();
    await prisma.onModuleInit();
    const owner = {
        id: randomUUID(),
        email: `${randomUUID()}@director.test`,
        role: UserRole.Client,
      },
      other = { id: randomUUID(), email: `${randomUUID()}@director.test`, role: UserRole.Client },
      actorUser = {
        id: randomUUID(),
        email: `${randomUUID()}@director.test`,
        role: UserRole.Actor,
      };
    const directory = await mkdtemp(join(tmpdir(), "director-service-test-")),
      sourcePath = join(directory, "source.mp4"),
      objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
    const signal = AbortSignal.timeout(110000);
    await runVideoCommand(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=320x240:r=24:d=8",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-y",
        sourcePath,
      ],
      signal,
    );
    const source = await readFile(sourcePath);
    const storage: StorageClient = {
      createPresignedUpload: async (input) => {
        const key = `actor-private/${input.pathPrefix}/${randomUUID()}.media`;
        return {
          key,
          bucket: "actor-private",
          path: key.slice(14),
          method: "PUT",
          assetUrl: "PUBLIC_URL_MUST_NOT_LEAK",
          uploadUrl: "https://test.invalid/signed-upload",
        };
      },
      uploadObject: async (key, bytes, contentType) => {
        objects.set(key, { bytes, contentType });
      },
      downloadObject: async (key) => {
        const object = objects.get(key);
        if (!object) throw new Error("Test object missing");
        return object.bytes;
      },
      deleteObject: async (key) => {
        objects.delete(key);
      },
      getObjectInfo: async (key) => {
        const object = objects.get(key);
        if (!object) throw new Error("Test object missing");
        return { sizeBytes: object.bytes.length, contentType: object.contentType };
      },
      createSignedReadUrl: async () => "https://test.invalid/private-signed-five-minute-url",
      getPublicUrl: () => "PUBLIC_URL_MUST_NOT_LEAK",
    };
    const config = new ConfigService({
      STORAGE_PROVIDER: "supabase",
      DIRECTOR_ENABLE_PAID_GENERATION: "true",
      DIRECTOR_VEO_API_KEY: "test-only",
      DIRECTOR_VEO_CENTS_PER_SECOND: "10",
      DIRECTOR_MONTHLY_BUDGET_CENTS: "1000",
    });
    let submissions = 0,
      polls = 0,
      mode = "normal";
    class TestProviders extends DirectorProviders {
      override async submit(...args: Parameters<DirectorProviders["submit"]>) {
        submissions++;
        if (mode === "ambiguous") throw new Error("Ambiguous submit timeout");
        return {
          id:
            args[0] === "veo"
              ? "models/veo-3.1-generate-preview/operations/test_only"
              : randomUUID(),
        };
      }
      override async poll() {
        polls++;
        if (mode === "transient") throw new DirectorProviderError("Rate limit", true);
        if (mode === "failure")
          throw new DirectorProviderError("Explicit simulated provider failure");
        return { done: true as const, url: "https://test.invalid/only-test" };
      }
      override async download() {
        return source;
      }
    }
    const providers = new TestProviders(config),
      service = new DirectorService(prisma, storage, config, providers),
      worker = new DirectorWorker(prisma, storage, config, providers, service);
    try {
      const created = await service.create(owner, {
        title: "Synthetic advertising test",
        demo: false,
      });
      let state = created;
      await service.create(other, { title: "Other owner", demo: false });
      await prisma.client.user.create({ data: actorUser });
      const actor = await prisma.client.actorProfile.create({
        data: {
          userId: actorUser.id,
          stageName: "TEST FIXTURE — not a real performer",
          slug: `director-test-${actorUser.id}`,
          status: "APPROVED",
          isDemo: false,
          consent: { create: { publicProfileConsent: true } },
        },
      });
      await worker.verifyRuntime();
      await suite.test("owner isolation, saved revisions and stale writes", async () => {
        await assert.rejects(service.get(other.id, state.id), /introuvable/);
        await assert.rejects(service.plan(other.id, state.id), /introuvable/);
        const document = structuredClone(state.document);
        document.shots = [
          createDirectorShot("dolly-in", "one", 4),
          createDirectorShot("dolly-out", "two", 4),
        ];
        state = await service.save(owner.id, state.id, { version: state.version, document });
        await assert.rejects(
          service.save(owner.id, state.id, { version: 1, document }),
          /modifié ailleurs/,
        );
        assert.equal((await service.history(owner.id, state.id)).length, 2);
        assert.equal((await service.get(owner.id, state.id)).version, 2);
        const rls = await prisma.client.$queryRaw<
          { relname: string; relrowsecurity: boolean }[]
        >`SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'Director%' AND relkind = 'r'`;
        assert.equal(
          rls
            .filter((row) =>
              [
                "DirectorProject",
                "DirectorRevision",
                "DirectorAsset",
                "DirectorJob",
                "DirectorWorker",
                "DirectorActorGrant",
              ].includes(row.relname),
            )
            .every((row) => row.relrowsecurity),
          true,
        );
      });
      const upload = async (
        name: string,
        kind: "clip" | "performance" = "clip",
        aiTransferAllowed = false,
      ) => {
        const reserved = await service.reserve(owner.id, state.id, {
          name,
          kind,
          contentType: "video/mp4",
          sizeBytes: source.length,
          rightsBasis: "Synthetic color video created only for tests",
          rightsConfirmed: true,
          aiTransferAllowed,
        });
        const asset = await prisma.client.directorAsset.findUniqueOrThrow({
          where: { id: reserved.assetId },
        });
        objects.set(asset.storageKey, { bytes: source, contentType: "video/mp4" });
        await service.completeUpload(owner.id, state.id, asset.id);
        await worker.tick(signal);
        return asset.id;
      };
      let clipId: string;
      await suite.test(
        "private upload requires rights and real inspection before playback",
        async () => {
          await assert.rejects(
            service.reserve(owner.id, state.id, {
              name: "x",
              kind: "clip",
              contentType: "video/mp4",
              sizeBytes: 1,
              rightsBasis: "none",
              rightsConfirmed: false,
              aiTransferAllowed: false,
            }),
          );
          clipId = await upload("synthetic-red.mp4");
          state = await service.get(owner.id, state.id);
          const asset = state.assets.find((asset) => asset.id === clipId)!;
          assert.equal(asset.status, "READY");
          assert.equal(asset.duration, 8);
          assert.equal(asset.width, 320);
          await assert.rejects(service.media(other.id, state.id, clipId), /introuvable/);
          assert.equal((await service.media(owner.id, state.id, clipId)).expiresInSeconds, 300);
          assert.ok(!JSON.stringify(state).includes("storageKey"));
          assert.ok(!JSON.stringify(state).includes("PUBLIC_URL"));
          assert.ok(!JSON.stringify(state).includes("providerRequest"));
        },
      );
      await suite.test(
        "incompatible assets and cross-project IDs never enter the document",
        async () => {
          const document = structuredClone(state.document);
          document.shots[0]!.clipAssetId = randomUUID();
          await assert.rejects(
            service.save(owner.id, state.id, { version: state.version, document }),
            /Ressource/,
          );
          document.shots[0]!.clipAssetId = clipId!;
          document.shots[0]!.duration = 10;
          await assert.rejects(
            service.save(owner.id, state.id, { version: state.version, document }),
            /trop court/,
          );
        },
      );
      await suite.test(
        "real actor consent is accepted only by the actor and invalidated by creative changes",
        async () => {
          const document = structuredClone(state.document);
          document.cast = [
            {
              id: "actor",
              name: actor.stageName,
              kind: "actor",
              actorProfileId: actor.id,
              performanceProjectId: null,
              referenceAssetId: null,
              rightsConfirmed: false,
              rightsBasis: "",
              position: { x: 0, y: 0.1, z: 0 },
              endPosition: { x: 0, y: 0.1, z: 0 },
            },
          ];
          state = await service.save(owner.id, state.id, { version: state.version, document });
          await assert.rejects(
            service.assertGenerationRights(prisma.client, state.id, state.document),
            /autorisation/,
          );
          const [grant] = await service.requestGrant(owner.id, state.id, {
            actorProfileId: actor.id,
            terms:
              "TEST ONLY — commercial AI transformation and transfer for this synthetic project, one month, France.",
          });
          const input = {
            accept: true,
            commercialUse: true,
            aiTransformation: true,
            providerTransfer: true,
          };
          await assert.rejects(service.acceptGrant(other.id, grant!.id, input), /introuvable/);
          await service.acceptGrant(actorUser.id, grant!.id, input);
          await service.assertGenerationRights(prisma.client, state.id, state.document);
          const changed = structuredClone(state.document);
          changed.shots[0]!.waypoints[0]!.position.x += 1;
          assert.notEqual(directorConsentScope(changed), directorConsentScope(state.document));
          await assert.rejects(
            service.assertGenerationRights(prisma.client, state.id, changed),
            /autorisation/,
          );
          await service.acceptGrant(actorUser.id, grant!.id, { ...input, accept: false });
          await assert.rejects(
            service.assertGenerationRights(prisma.client, state.id, state.document),
            /autorisation/,
          );
          const cleared = structuredClone(state.document);
          cleared.cast = [];
          state = await service.save(owner.id, state.id, {
            version: state.version,
            document: cleared,
          });
        },
      );
      const enqueue = (requestKey = randomUUID(), maxCostCents = 40) =>
        service.enqueue(owner.id, state.id, {
          version: state.version,
          requestKey,
          kind: "GENERATE",
          shotId: "one",
          provider: "veo",
          maxCostCents,
          confirmBillable: true,
          confirmRights: true,
        });
      await suite.test(
        "billing consent, ceiling, idempotency and immutable snapshots",
        async () => {
          await assert.rejects(
            service.enqueue(owner.id, state.id, {
              version: state.version,
              requestKey: randomUUID(),
              kind: "GENERATE",
              shotId: "one",
              provider: "veo",
              maxCostCents: 40,
              confirmBillable: false,
              confirmRights: true,
            }),
            /Confirmez/,
          );
          await assert.rejects(enqueue(randomUUID(), 39), /plafond/);
          const key = randomUUID();
          await Promise.all([enqueue(key), enqueue(key)]);
          assert.equal(
            await prisma.client.directorJob.count({
              where: { ownerId: owner.id, kind: "GENERATE" },
            }),
            1,
          );
          await assert.rejects(enqueue(key, 60), /Clé de demande/);
          const job = await prisma.client.directorJob.findFirstOrThrow({
            where: { ownerId: owner.id, kind: "GENERATE" },
          });
          const document = structuredClone(state.document);
          document.shots[0]!.prompt = "New creative direction after the first job";
          state = await service.save(owner.id, state.id, { version: state.version, document });
          assert.ok(!JSON.stringify(job.input).includes("New creative direction"));
          await worker.tick(signal);
          assert.equal(submissions, 1);
          await prisma.client.directorJob.update({
            where: { id: job.id },
            data: { nextRunAt: new Date(0) },
          });
          await new DirectorWorker(prisma, storage, config, providers, service).tick(signal);
          const complete = await prisma.client.directorJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          assert.equal(complete.status, "SUCCEEDED");
          assert.equal(submissions, 1);
          assert.equal(polls, 1);
          assert.ok(complete.resultAssetId);
        },
      );
      await suite.test(
        "a single replacement preserves other clips, assembly persists and old revisions restore",
        async () => {
          const document = structuredClone(state.document);
          document.shots.forEach((shot) => {
            shot.clipAssetId = clipId!;
          });
          state = await service.save(owner.id, state.id, { version: state.version, document });
          const second = await upload("synthetic-replacement.mp4");
          const replacement = structuredClone(state.document);
          replacement.shots[1]!.clipAssetId = second;
          state = await service.save(owner.id, state.id, {
            version: state.version,
            document: replacement,
          });
          assert.equal(state.document.shots[0]!.clipAssetId, clipId!);
          await service.enqueue(owner.id, state.id, {
            version: state.version,
            requestKey: randomUUID(),
            kind: "EXPORT",
            maxCostCents: 0,
            confirmBillable: false,
            confirmRights: true,
          });
          await worker.tick(signal);
          state = await service.get(owner.id, state.id);
          const job = state.jobs.find((job) => job.kind === "EXPORT")!;
          assert.equal(job.status, "SUCCEEDED", job.error ?? "");
          assert.ok(job.resultAssetId);
          assert.equal(
            state.assets.find((asset) => asset.id === job.resultAssetId)!.duration! < 8.15,
            true,
          );
          await assert.rejects(service.removeAsset(owner.id, state.id, clipId!), /historique/);
          const history = await service.history(owner.id, state.id);
          const original = history.find((revision) => revision.version === 1)!;
          const restored = await service.restore(owner.id, state.id, {
            version: state.version,
            revisionId: original.id,
          });
          assert.equal(restored.document.shots.length, 1);
          assert.ok(restored.version > state.version);
          assert.ok(restored.jobs.some((candidate) => candidate.id === job.id));
          state = await service.save(owner.id, state.id, {
            version: restored.version,
            document: state.document,
          });
        },
      );
      await suite.test(
        "cancelled work never publishes and ambiguous submits are not retried",
        async () => {
          const queued = await enqueue();
          const job = queued.jobs.find(
            (job) => job.kind === "GENERATE" && job.status === "QUEUED",
          )!;
          await assert.rejects(service.cancel(other.id, state.id, job.id), /introuvable/);
          await service.cancel(owner.id, state.id, job.id);
          const before = submissions;
          await worker.tick(signal);
          assert.equal(submissions, before);
          mode = "ambiguous";
          const next = await enqueue();
          const ambiguous = next.jobs.find(
            (job) => job.kind === "GENERATE" && job.status === "QUEUED",
          )!;
          await worker.tick(signal);
          assert.equal(submissions, before + 1);
          assert.equal(
            (await prisma.client.directorJob.findUniqueOrThrow({ where: { id: ambiguous.id } }))
              .status,
            "FAILED",
          );
          await worker.tick(signal);
          assert.equal(submissions, before + 1);
          mode = "normal";
          const recovered = await enqueue();
          const interrupted = recovered.jobs.find(
            (job) => job.kind === "GENERATE" && job.status === "QUEUED",
          )!;
          await prisma.client.directorJob.update({
            where: { id: interrupted.id },
            data: { status: "SUBMITTING" },
          });
          await worker.tick(signal);
          assert.equal(submissions, before + 1);
          assert.match(
            (await prisma.client.directorJob.findUniqueOrThrow({ where: { id: interrupted.id } }))
              .error!,
            /ambiguë/,
          );
        },
      );
      await suite.test(
        "transient polling backs off and a UTC future task is not claimed",
        async () => {
          const queued = await enqueue(),
            job = queued.jobs.find((job) => job.kind === "GENERATE" && job.status === "QUEUED")!;
          await worker.tick(signal);
          mode = "transient";
          await prisma.client.directorJob.update({
            where: { id: job.id },
            data: { nextRunAt: new Date(0) },
          });
          await worker.tick(signal);
          const retry = await prisma.client.directorJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          assert.equal(retry.status, "WAITING_PROVIDER");
          assert.equal(retry.attempts, 1);
          assert.ok(retry.nextRunAt.getTime() > Date.now());
          assert.equal(await worker.tick(signal), false);
          mode = "failure";
          await prisma.client.directorJob.update({
            where: { id: job.id },
            data: { nextRunAt: new Date(0) },
          });
          await worker.tick(signal);
          assert.equal(
            (await prisma.client.directorJob.findUniqueOrThrow({ where: { id: job.id } })).status,
            "FAILED",
          );
          assert.ok((await service.capabilities(owner.id)).reservedCents > 0);
          config.set("DIRECTOR_MONTHLY_BUDGET_CENTS", "1");
          await assert.rejects(enqueue(), /budget mensuel/);
          config.set("DIRECTOR_MONTHLY_BUDGET_CENTS", "1000");
        },
      );
      await suite.test(
        "Higgsfield receives an actual timed private performance excerpt and deletes temporary inputs",
        async () => {
          mode = "normal";
          config.set("DIRECTOR_HIGGSFIELD_API_KEY", "test-only");
          config.set("DIRECTOR_HIGGSFIELD_CENTS_PER_SECOND", "10");
          await worker.heartbeat();
          const performance = await upload("synthetic-performance.mp4", "performance", true);
          const document = structuredClone(state.document);
          document.tracks = [
            {
              id: "recorded_performance",
              track: "performance",
              label: "Synthetic clip excerpt",
              start: 0,
              duration: 4,
              offset: 2,
              volume: 0,
              fadeIn: 0,
              fadeOut: 0,
              assetId: performance,
              castId: null,
              instructions: "Test-only performance timing",
            },
          ];
          state = await service.save(owner.id, state.id, { version: state.version, document });
          const queued = await service.enqueue(owner.id, state.id, {
            version: state.version,
            requestKey: randomUUID(),
            kind: "GENERATE",
            shotId: "one",
            provider: "higgsfield",
            maxCostCents: 40,
            confirmBillable: true,
            confirmRights: true,
          });
          const job = queued.jobs.find(
            (job) => job.status === "QUEUED" && job.kind === "GENERATE",
          )!;
          await worker.tick(signal);
          const temporary = [...objects.entries()].find(([key]) =>
            key.includes(`/provider-inputs/${job.id}/`),
          );
          assert.ok(temporary);
          const path = join(directory, "excerpt.mp4");
          await writeFile(path, temporary[1].bytes);
          const excerpt = await inspectDirectorAsset(path, "video/mp4", "ffprobe", signal);
          assert.ok(Math.abs(excerpt.duration! - 4) < 0.08);
          assert.equal(excerpt.width, 1280);
          await prisma.client.directorJob.update({
            where: { id: job.id },
            data: { nextRunAt: new Date(0) },
          });
          await worker.tick(signal);
          assert.equal(
            (await prisma.client.directorJob.findUniqueOrThrow({ where: { id: job.id } })).status,
            "SUCCEEDED",
          );
          assert.equal(objects.has(temporary[0]), false);
        },
      );
    } finally {
      await prisma.client.user.deleteMany({
        where: { id: { in: [owner.id, other.id, actorUser.id] } },
      });
      await prisma.client.directorWorker.deleteMany({});
      await prisma.onModuleDestroy();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
