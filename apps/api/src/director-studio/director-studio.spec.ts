import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { studioDemoScene } from "@actbyme/shared";
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
            scene: studioDemoScene,
            instructions: "First edit",
            roleId: "lea",
          }),
          studio.save(ownerId, projectId, {
            version: state.version,
            scene: studioDemoScene,
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
            scene: studioDemoScene,
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
              scene: studioDemoScene,
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
