// Optional real-provider smoke test. Requires an isolated local PostgreSQL database.
import "reflect-metadata";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../dist/database/prisma.service.js";
import { GeminiDirectorService } from "../dist/performance-projects/gemini-director.service.js";
import { DirectorStudioService } from "../dist/director-studio/director-studio.service.js";
import { createStudioFixture } from "../dist/director-studio/studio-fixtures.js";
if (!process.env.STUDIO_TEST_DATABASE_URL?.match(/(?:localhost|127\.0\.0\.1).*studio_test/))
  throw new Error("Use an isolated local studio_test database.");
const local = parseEnv(await readFile(new URL("../../../.env", import.meta.url), "utf8"));
for (const key of ["GEMINI_API_KEY", "GEMINI_DIRECTOR_MODEL", "GEMINI_DIRECTOR_FALLBACK_MODELS"])
  if (!process.env[key] && local[key]) process.env[key] = local[key];
if (!process.env.GEMINI_API_KEY) {
  console.log("Real Gemini check skipped: no API key configured.");
  process.exit(0);
}
const upstreamFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await upstreamFetch(...args);
  if (!response.ok) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    const message = payload?.error?.message;
    if (typeof message === "string")
      console.log(
        "Gemini error:",
        message.split(process.env.GEMINI_API_KEY).join("[redacted]").slice(0, 600),
      );
  }
  return response;
};
process.env.DATABASE_URL = process.env.STUDIO_TEST_DATABASE_URL;
const prisma = new PrismaService();
const fixture = await createStudioFixture(prisma);
const studio = new DirectorStudioService(prisma, new GeminiDirectorService(new ConfigService()));
try {
  let state = await studio.activate(fixture.ownerId, fixture.projectId, {
    version: 0,
    enabled: true,
  });
  await studio.generate(fixture.ownerId, fixture.projectId, {
    version: state.version,
    instructions:
      "Three named characters Léa, Marc and Sam. Léa walks towards Marc then waves and points to Sam. Marc sits near the end. Sam crosses behind them. A wide shot, two reverse shots and a final tracking shot. Keep the scene 24 seconds.",
  });
  await studio.tick();
  state = await studio.get(fixture.ownerId, fixture.projectId);
  if (state.job?.status !== "COMPLETED") throw new Error(state.job?.error ?? "Generation failed");
  const originalScene = state.revision.scene;
  const targetColor =
    originalScene.characters[0].color.toLowerCase() === "#80c5aa" ? "#76aee8" : "#80c5aa";
  await studio.edit(fixture.ownerId, fixture.projectId, {
    version: state.version,
    instructions:
      "Change only this character's outfit color to " +
      targetColor +
      ". Keep their name, dialogue, movements and all camera views unchanged. Return only id and color, no keyframes.",
    target: { kind: "character", id: originalScene.characters[0].id },
  });
  await studio.tick();
  state = await studio.get(fixture.ownerId, fixture.projectId);
  if (state.job?.status !== "COMPLETED")
    throw new Error(state.job?.error ?? "Targeted edit failed");
  if (
    JSON.stringify(state.revision.scene.shots) !== JSON.stringify(originalScene.shots) ||
    JSON.stringify(state.revision.scene.characters.slice(1)) !==
      JSON.stringify(originalScene.characters.slice(1))
  )
    throw new Error("A targeted edit changed unrelated scene elements.");
  if (
    state.revision.scene.characters[0].color.toLowerCase() !== targetColor ||
    JSON.stringify(state.revision.scene.characters[0].keyframes) !==
      JSON.stringify(originalScene.characters[0].keyframes)
  )
    throw new Error("The colour edit was not exact or changed the animation.");
  state = await studio.approve(fixture.ownerId, fixture.projectId, {
    version: state.version,
    roleId: originalScene.characters[0].id,
  });
  const project = await prisma.client.performanceProject.findUniqueOrThrow({
    where: { id: fixture.projectId },
    include: { scenes: true },
  });
  if (
    project.scenes[0].dialogue !== project.actorGuide.dialogue ||
    project.scenes[0].duration !== project.actorGuide.duration ||
    state.stale
  )
    throw new Error("The actor plan and preview are not synchronized.");
  console.log(
    JSON.stringify({
      realGemini: "passed",
      targetedEdit: "passed",
      synchronizedActorPlan: "passed",
      characters: state.revision.scene.characters.length,
      shots: state.revision.scene.shots.length,
      duration: state.revision.scene.duration,
      model: state.revision.model,
    }),
  );
} finally {
  await prisma.client.user.deleteMany({
    where: { id: { in: [fixture.ownerId, fixture.actorUserId, fixture.otherUserId] } },
  });
  await prisma.onModuleDestroy();
}
