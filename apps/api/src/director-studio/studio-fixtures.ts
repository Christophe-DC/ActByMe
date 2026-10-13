import { randomUUID } from "node:crypto";
import type { PrismaService } from "../database/prisma.service.js";
import { studioDemoScene } from "@actbyme/shared";
import type { DirectorProviderRequest } from "../performance-projects/ai-director.contract.js";

export const fixtureGuide = {
  overview: "Meet Marc and greet him warmly.",
  duration: "24 seconds",
  dialogue: "Tu es venu.",
  steps: [{ order: 1, title: "Approach", instruction: "Walk towards Marc and wave." }],
  finalChecklist: ["One continuous take", "Clear voice"],
};
export async function createStudioFixture(prisma: PrismaService) {
  const ownerId = randomUUID();
  const actorUserId = randomUUID();
  const otherUserId = randomUUID();
  await prisma.client.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@studio.test`, role: "CLIENT" },
      { id: actorUserId, email: `${actorUserId}@studio.test`, role: "ACTOR" },
      { id: otherUserId, email: `${otherUserId}@studio.test`, role: "CLIENT" },
    ],
  });
  const actor = await prisma.client.actorProfile.create({
    data: {
      userId: actorUserId,
      slug: `studio-${actorUserId}`,
      stageName: `Test performer ${actorUserId.slice(0, 8)}`,
      status: "APPROVED",
      isDemo: false,
    },
  });
  const project = await prisma.client.performanceProject.create({
    data: {
      ownerId,
      title: "Studio integration test",
      type: "Scene",
      companyName: "Studio test",
      script:
        "Léa approaches Marc. Sam crosses behind them. Léa: Tu es venu. Marc: Je voulais vous parler. Sam: Nous t'écoutons.",
      workflowStatus: "PERFORMER_SELECTION",
      currentStep: "actor",
      actorGuide: fixtureGuide,
      aiEnginePrompt: "Use the supplied performance.",
      outputsBriefVersion: 1,
      outputsGeneratedAt: new Date(),
      brief: {
        create: {
          talentRequirements: { language: "French", performerProfile: "Natural actor" },
          capturePlan: { orientation: "Landscape", camera: "Tripod" },
          globalDirection: "Warm to confident",
          qaCriteria: ["Continuous take"],
          model: "fixture",
          version: 1,
          approvedVersion: 1,
          approvedAt: new Date(),
        },
      },
      scenes: {
        create: {
          position: 0,
          title: "Meeting",
          duration: "24 seconds",
          dialogue: "Tu es venu.",
          direction: "Greet Marc.",
          framing: "Medium",
        },
      },
    },
  });
  return {
    ownerId,
    actorUserId,
    otherUserId,
    actorId: actor.id,
    actorName: actor.stageName,
    projectId: project.id,
  };
}
export const fixtureGemini = {
  async generate(request: DirectorProviderRequest) {
    if (request.schemaName === "actbyme_studio_patch") {
      const input = JSON.parse(request.input);
      const character = structuredClone(
        input.currentScene.characters.find((item: { id: string }) => item.id === input.target.id) ??
          input.currentScene.characters[0],
      );
      character.color = character.color === "#80c5aa" ? "#76aee8" : "#80c5aa";
      const rename = input.instructions.match(/rename.*?to[ "]+([^".]+)\.?/i);
      if (rename) character.name = rename[1].trim();
      return {
        model: "fixture-studio",
        responseId: "fixture-patch",
        outputText: JSON.stringify({
          summary: "Updated character",
          characters: [character],
          shots: [],
          props: [],
          cues: [],
          removeCharacters: [],
          removeShots: [],
          removeProps: [],
          removeCues: [],
          title: null,
          duration: null,
        }),
      };
    }
    return {
      outputText: JSON.stringify(studioDemoScene),
      model: "fixture-studio",
      responseId: "fixture-response",
    };
  },
};
