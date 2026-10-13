import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { GeminiDirectorService } from "../performance-projects/gemini-director.service.js";
import { DirectorStudioService } from "./director-studio.service.js";
import {
  studioInputHash,
  lockStudioProject,
  studioRevisionForAssignment,
} from "./studio-policy.js";
import { createStudioFixture, fixtureGemini } from "./studio-fixtures.js";

const databaseUrl = process.env.STUDIO_TEST_DATABASE_URL;
test("input fingerprint ignores approval timestamps but tracks creative changes", () => {
  const project = {
    script: "Hello",
    brief: { version: 1, globalDirection: "Warm" },
    scenes: [{ title: "Scene", duration: "24 seconds" }],
  };
  const before = studioInputHash(project);
  assert.equal(
    studioInputHash({
      ...project,
      brief: { ...project.brief, approvedAt: new Date(), approvedVersion: 1 },
    }),
    before,
  );
  assert.notEqual(studioInputHash({ ...project, script: "Goodbye" }), before);
  assert.notEqual(studioInputHash({ ...project, scenes: [{ title: "Changed" }] }), before);
});

test(
  "PostgreSQL: lifecycle, concurrency, assignment snapshots, authorization and failures",
  { skip: !databaseUrl },
  async (suite) => {
    assert.match(databaseUrl!, /(?:localhost|127\.0\.0\.1).*studio_test/);
    process.env.DATABASE_URL = databaseUrl;
    const prisma = new PrismaService();
    const fixture = await createStudioFixture(prisma);
    const studio = new DirectorStudioService(prisma, fixtureGemini as GeminiDirectorService);
    const { ownerId, otherUserId, projectId } = fixture;
    try {
      await suite.test("no studio leaves the original assignment path available", async () => {
        assert.equal(
          await prisma.client.$transaction((transaction) =>
            studioRevisionForAssignment(transaction, projectId),
          ),
          null,
        );
        assert.equal((await studio.get(ownerId, projectId)).enabled, false);
      });
      await suite.test(
        "owner authorization, stale writes, pending generation and persisted reload",
        async () => {
          await assert.rejects(studio.get(otherUserId, projectId), NotFoundException);
          let state = await studio.activate(ownerId, projectId, { version: 0, enabled: true });
          await assert.rejects(
            studio.activate(ownerId, projectId, { version: 0, enabled: false }),
            ConflictException,
          );
          await assert.rejects(
            prisma.client.$transaction((transaction) =>
              studioRevisionForAssignment(transaction, projectId),
            ),
            ConflictException,
          );
          state = await studio.generate(ownerId, projectId, {
            version: state.version,
            instructions: "Three characters, four camera angles",
          });
          assert.equal(state.job?.status, "QUEUED");
          await assert.rejects(
            studio.generate(ownerId, projectId, { version: state.version, instructions: "Again" }),
            ConflictException,
          );
          await studio.tick();
          state = await new DirectorStudioService(
            prisma,
            fixtureGemini as GeminiDirectorService,
          ).get(ownerId, projectId);
          assert.equal(state.job?.status, "COMPLETED");
          assert.equal(state.revision?.scene.characters.length, 3);
        },
      );
      await suite.test("concurrent saves allow exactly one revision", async () => {
        const state = await studio.get(ownerId, projectId);
        const writes = await Promise.allSettled([
          studio.save(ownerId, projectId, {
            version: state.version,
            scene: state.revision!.scene,
            instructions: "First edit",
            roleId: "lea",
          }),
          studio.save(ownerId, projectId, {
            version: state.version,
            scene: state.revision!.scene,
            instructions: "Second edit",
            roleId: "lea",
          }),
        ]);
        assert.equal(writes.filter((write) => write.status === "fulfilled").length, 1);
        assert.equal(writes.filter((write) => write.status === "rejected").length, 1);
      });
      await suite.test(
        "creative changes invalidate approval and accepted versions remain immutable",
        async () => {
          let state = await studio.get(ownerId, projectId);
          state = await studio.approve(ownerId, projectId, {
            version: state.version,
            roleId: "lea",
          });
          const approvedId = state.revision!.id;
          await prisma.client.performanceProject.update({
            where: { id: projectId },
            data: { script: "Changed script" },
          });
          assert.equal((await studio.get(ownerId, projectId)).stale, true);
          await assert.rejects(
            prisma.client.$transaction((transaction) =>
              studioRevisionForAssignment(transaction, projectId),
            ),
            ConflictException,
          );
          state = await studio.save(ownerId, projectId, {
            version: state.version,
            scene: state.revision!.scene,
            instructions: "Manual revision",
            roleId: "lea",
          });
          assert.equal(state.revision?.approvedAt, null);
          state = await studio.approve(ownerId, projectId, {
            version: state.version,
            roleId: "lea",
          });
          assert.notEqual(state.revision?.id, approvedId);
          assert.ok(
            (
              await prisma.client.directorStudioRevision.findUniqueOrThrow({
                where: { id: approvedId },
              })
            ).approvedAt,
          );
        },
      );
      await suite.test(
        "invalid provider responses preserve the existing preview; orphaned jobs fail recoverably",
        async () => {
          const state = await studio.get(ownerId, projectId);
          const previousId = state.revision!.id;
          await studio.generate(ownerId, projectId, {
            version: state.version,
            instructions: "Revise",
          });
          const invalid = new DirectorStudioService(prisma, {
            generate: async () => ({ outputText: "{}", model: "bad", responseId: null }),
          } as unknown as GeminiDirectorService);
          await invalid.tick();
          let next = await studio.get(ownerId, projectId);
          assert.equal(next.job?.status, "FAILED");
          assert.equal(next.revision?.id, previousId);
          await studio.generate(ownerId, projectId, {
            version: next.version,
            instructions: "Retry",
          });
          next = await studio.get(ownerId, projectId);
          await prisma.client.directorStudioJob.update({
            where: { id: next.job!.id },
            data: {
              status: "RUNNING",
              token: "a83ca760-7072-4c03-b6df-1aafca283753",
              startedAt: new Date(Date.now() - 21 * 60000),
            },
          });
          await studio.tick();
          assert.equal((await studio.get(ownerId, projectId)).job?.status, "FAILED");
        },
      );
      await suite.test(
        "sent assignment pins the approved revision and freezes mutations",
        async () => {
          const state = await studio.get(ownerId, projectId);
          await prisma.client.$transaction(async (transaction) => {
            await lockStudioProject(transaction, projectId);
            const revisionId = await studioRevisionForAssignment(transaction, projectId);
            await transaction.performanceAssignment.create({
              data: {
                projectId,
                actorProfileId: fixture.actorId,
                studioRevisionId: revisionId,
                sentAt: new Date(),
              },
            });
          });
          await assert.rejects(
            studio.save(ownerId, projectId, {
              version: state.version,
              scene: state.revision!.scene,
              instructions: "Cannot change",
              roleId: "lea",
            }),
            ConflictException,
          );
          assert.equal((await studio.get(ownerId, projectId)).locked, true);
          const assignment = await prisma.client.performanceAssignment.findUniqueOrThrow({
            where: { projectId },
            include: { studioRevision: true },
          });
          assert.equal(assignment.studioRevision?.id, state.revision?.id);
        },
      );
    } finally {
      await prisma.client.performanceAssignment.deleteMany({ where: { projectId } });
      await prisma.client.user.deleteMany({
        where: { id: { in: [ownerId, fixture.actorUserId, otherUserId] } },
      });
      await prisma.onModuleDestroy();
    }
  },
);

test(
  "PostgreSQL: standalone templates, history, scoped edits and private revocable sharing",
  { skip: !databaseUrl },
  async () => {
    process.env.DATABASE_URL = databaseUrl!;
    const prisma = new PrismaService();
    const fixture = await createStudioFixture(prisma);
    const studio = new DirectorStudioService(prisma, fixtureGemini as GeminiDirectorService);
    try {
      let state = await studio.create(
        { id: fixture.ownerId, role: "CLIENT" as never },
        {
          title: "My accessible scene",
          script: "Alex smiles and waves.",
          templateId: "introduction",
          instructions: "A friendly greeting.",
        },
      );
      assert.equal(state.needsBrief, true);
      assert.ok(state.revision);
      const first = state.revision!;
      const shared = await studio.share(fixture.ownerId, state.projectId, {
        version: state.version,
      });
      const preview = await studio.shared(shared.token);
      assert.equal(preview.scene.title, "My accessible scene");
      assert.equal("instructions" in preview, false);
      await assert.rejects(
        studio.share(fixture.otherUserId, state.projectId, { version: state.version }),
        NotFoundException,
      );
      await assert.rejects(
        studio.restore(fixture.otherUserId, state.projectId, {
          version: state.version,
          revisionId: first.id,
        }),
        NotFoundException,
      );
      state = await studio.edit(fixture.ownerId, state.projectId, {
        version: state.version,
        instructions: "Change this person's color",
        target: { kind: "character", id: "presenter" },
      });
      await studio.tick();
      state = await studio.get(fixture.ownerId, state.projectId);
      assert.equal(state.job?.status, "COMPLETED");
      assert.deepEqual(state.revision!.scene.shots, first.scene.shots);
      assert.equal(state.revision!.scene.characters[0]!.color, "#80c5aa");
      assert.deepEqual((await studio.shared(shared.token)).scene, first.scene);
      const history = await studio.history(fixture.ownerId, state.projectId);
      assert.equal(history.revisions.length, 2);
      state = await studio.restore(fixture.ownerId, state.projectId, {
        version: state.version,
        revisionId: first.id,
      });
      assert.equal(state.revision!.scene.characters[0]!.color, first.scene.characters[0]!.color);
      assert.equal(state.revision!.approvedAt, null);
      await studio.revokeShare(fixture.ownerId, state.projectId, shared.id);
      await assert.rejects(studio.shared(shared.token), NotFoundException);
      const expiring = await studio.share(fixture.ownerId, state.projectId, {
        version: state.version,
      });
      await prisma.client.directorStudioShare.update({
        where: { id: expiring.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await assert.rejects(studio.shared(expiring.token), NotFoundException);
    } finally {
      await prisma.client.user.deleteMany({
        where: { id: { in: [fixture.ownerId, fixture.actorUserId, fixture.otherUserId] } },
      });
      await prisma.onModuleDestroy();
    }
  },
);

test(
  "PostgreSQL: assistant-only scene changes, synchronized shooting guide, feedback and cancellation",
  { skip: !databaseUrl },
  async () => {
    process.env.DATABASE_URL = databaseUrl!;
    const prisma = new PrismaService();
    const fixture = await createStudioFixture(prisma);
    const studio = new DirectorStudioService(prisma, fixtureGemini as GeminiDirectorService);
    try {
      let state = await studio.create(
        { id: fixture.ownerId, role: "CLIENT" as never },
        { title: "A real scene", script: "Alex greets the viewer.", templateId: "introduction" },
      );
      const original = structuredClone(state.revision!.scene);
      const changed = structuredClone(original);
      changed.characters[0]!.keyframes[0]!.position.x = 2;
      await assert.rejects(
        studio.save(fixture.ownerId, state.projectId, {
          version: state.version,
          scene: changed,
          instructions: "Manual geometry",
          roleId: "presenter",
        }),
        /assistant/,
      );
      assert.equal((await studio.get(fixture.ownerId, state.projectId)).version, state.version);
      const spoken = structuredClone(original);
      spoken.cues[0]!.dialogue = "A new beginning.";
      state = await studio.save(fixture.ownerId, state.projectId, {
        version: state.version,
        scene: spoken,
        instructions: "Greeting",
        roleId: "presenter",
      });
      state = await studio.approve(fixture.ownerId, state.projectId, {
        version: state.version,
        roleId: "presenter",
      });
      const project = await prisma.client.performanceProject.findUniqueOrThrow({
        where: { id: state.projectId },
        include: { brief: true, scenes: true },
      });
      assert.equal(project.scenes[0]!.dialogue, "A new beginning.");
      assert.equal(
        (project.actorGuide as { dialogue: string }).dialogue,
        project.scenes[0]!.dialogue,
      );
      assert.equal(project.scenes[0]!.duration, "20 seconds");
      assert.equal(state.stale, false);
      assert.ok(project.brief?.approvedAt);
      assert.equal(
        await prisma.client.$transaction((tx) => studioRevisionForAssignment(tx, state.projectId)),
        state.revision!.id,
      );
      const shared = await studio.share(fixture.ownerId, state.projectId, {
        version: state.version,
        allowComments: true,
      });
      const viewer = { id: fixture.otherUserId, role: "CLIENT" as never };
      const note = await studio.comment(viewer, shared.token, {
        authorName: "Reviewer",
        body: "Wait before waving.",
        time: 4,
        target: { kind: "character", id: "presenter" },
      });
      assert.equal((await studio.shared(shared.token)).comments.length, 1);
      assert.equal("authorId" in note, false);
      await assert.rejects(
        studio.feedback(fixture.otherUserId, state.projectId),
        NotFoundException,
      );
      await studio.resolveFeedback(fixture.ownerId, state.projectId, note.id, { resolved: true });
      assert.equal((await studio.feedback(fixture.ownerId, state.projectId))[0]!.resolved, true);
      await studio.revokeShare(fixture.ownerId, state.projectId, shared.id);
      await assert.rejects(
        studio.comment(viewer, shared.token, {
          authorName: "Reviewer",
          body: "Too late",
          time: 0,
          target: { kind: "scene", id: "scene" },
        }),
        NotFoundException,
      );
      state = await studio.edit(fixture.ownerId, state.projectId, {
        version: state.version,
        instructions: "Wave later.",
        target: { kind: "character", id: "presenter" },
        at: 4,
      });
      state = await studio.cancel(fixture.ownerId, state.projectId, { version: state.version });
      assert.equal(state.job!.status, "CANCELLED");
      await studio.tick();
      assert.deepEqual(state.revision!.scene, spoken);
      let attempts = 0;
      const repairing = new DirectorStudioService(prisma, {
        generate: async (request: Parameters<typeof fixtureGemini.generate>[0]) => {
          attempts++;
          return attempts === 1
            ? { outputText: "{}", model: "invalid", responseId: null }
            : fixtureGemini.generate({
                ...request,
                input: JSON.stringify({
                  currentScene: spoken,
                  target: { kind: "character", id: "presenter" },
                  instructions: "Change color",
                }),
              });
        },
      } as unknown as GeminiDirectorService);
      state = await studio.edit(fixture.ownerId, state.projectId, {
        version: state.version,
        instructions: "Change color",
        target: { kind: "character", id: "presenter" },
      });
      await repairing.tick();
      assert.equal(attempts, 2);
      assert.equal((await studio.get(fixture.ownerId, state.projectId)).job!.status, "COMPLETED");
    } finally {
      await prisma.client.user.deleteMany({
        where: { id: { in: [fixture.ownerId, fixture.actorUserId, fixture.otherUserId] } },
      });
      await prisma.onModuleDestroy();
    }
  },
);

test(
  "PostgreSQL: cancellation aborts the running provider and ignores its late response",
  { skip: !databaseUrl },
  async () => {
    process.env.DATABASE_URL = databaseUrl!;
    const prisma = new PrismaService();
    const fixture = await createStudioFixture(prisma);
    let finish:
      | ((response: Awaited<ReturnType<typeof fixtureGemini.generate>>) => void)
      | undefined;
    let signal: AbortSignal | undefined;
    let request: Parameters<typeof fixtureGemini.generate>[0] | undefined;
    const studio = new DirectorStudioService(prisma, {
      generate: (
        input: Parameters<typeof fixtureGemini.generate>[0],
        options: { signal: AbortSignal },
      ) => {
        signal = options.signal;
        request = input;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    } as unknown as GeminiDirectorService);
    try {
      let state = await studio.create(
        { id: fixture.ownerId, role: "CLIENT" as never },
        { title: "Cancelable scene", script: "Alex waves.", templateId: "introduction" },
      );
      const original = state.revision!.scene;
      state = await studio.edit(fixture.ownerId, state.projectId, {
        version: state.version,
        instructions: "Change color",
        target: { kind: "character", id: "presenter" },
      });
      const working = studio.tick();
      for (let attempt = 0; attempt < 100 && !finish; attempt++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.ok(finish);
      assert.equal((await studio.get(fixture.ownerId, state.projectId)).job!.status, "RUNNING");
      await assert.rejects(
        studio.cancel(fixture.otherUserId, state.projectId, { version: state.version }),
        NotFoundException,
      );
      state = await studio.cancel(fixture.ownerId, state.projectId, { version: state.version });
      assert.equal(signal!.aborted, true);
      finish(await fixtureGemini.generate(request!));
      await working;
      const after = await studio.get(fixture.ownerId, state.projectId);
      assert.equal(after.job!.status, "CANCELLED");
      assert.deepEqual(after.revision!.scene, original);
      assert.equal((await studio.history(fixture.ownerId, state.projectId)).revisions.length, 1);
    } finally {
      await prisma.client.user.deleteMany({
        where: { id: { in: [fixture.ownerId, fixture.actorUserId, fixture.otherUserId] } },
      });
      await prisma.onModuleDestroy();
    }
  },
);
