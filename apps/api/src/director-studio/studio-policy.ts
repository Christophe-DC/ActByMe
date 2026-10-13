import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@actbyme/database";
import type { StudioRecordingPlan } from "@actbyme/shared";

export function studioInputHash(project: {
  script: string | null;
  briefAttachment?: { extractedText: string | null } | null;
  brief: unknown;
  scenes: Array<Record<string, unknown>>;
}) {
  const brief = project.brief as Record<string, unknown> | null;
  return createHash("sha256")
    .update(
      JSON.stringify({
        script: project.script?.trim() || project.briefAttachment?.extractedText?.trim() || "",
        brief: brief
          ? {
              version: brief.version,
              talentRequirements: brief.talentRequirements,
              capturePlan: brief.capturePlan,
              globalDirection: brief.globalDirection,
              qaCriteria: brief.qaCriteria,
            }
          : null,
        scenes: project.scenes.map((scene) =>
          Object.fromEntries(
            [
              "title",
              "duration",
              "dialogue",
              "direction",
              "startingPosition",
              "bodyPosition",
              "eyeline",
              "gestures",
              "framing",
              "captureRequirements",
              "emotionalProgression",
            ].map((key) => [key, scene[key]]),
          ),
        ),
      }),
    )
    .digest("hex");
}

export async function lockStudioProject(transaction: Prisma.TransactionClient, projectId: string) {
  await transaction.$queryRaw`SELECT "id" FROM "PerformanceProject" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
}

// Called inside the assignment transaction after acquiring the project lock.
export async function studioRevisionForAssignment(
  transaction: Prisma.TransactionClient,
  projectId: string,
) {
  const project = await transaction.performanceProject.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      brief: true,
      assignment: true,
      briefAttachment: true,
      scenes: { orderBy: { position: "asc" } },
      directorStudio: {
        include: {
          revisions: { orderBy: { version: "desc" }, take: 1 },
          jobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } },
        },
      },
    },
  });
  const studio = project.directorStudio;
  if (!studio?.enabled) return null;
  const revision = studio.revisions[0];
  if (
    project.workflowStatus === "GENERATING_BRIEF" ||
    studio.jobs.length ||
    !revision?.approvedAt ||
    !revision.roleId ||
    revision.inputHash !== studioInputHash(project)
  ) {
    throw new ConflictException(
      "Validate the current Director Studio 3D revision before sending this request.",
    );
  }
  if (!revision.recordingPlan) {
    if (project.assignment?.studioRevisionId === revision.id) return revision.id;
    throw new ConflictException(
      "Prepare the actor guide from the current 3D scene before sending this request.",
    );
  }
  const plan = revision.recordingPlan as unknown as StudioRecordingPlan;
  if (
    project.scenes.length !== 1 ||
    project.scenes[0]!.dialogue !== plan.sceneFields.dialogue ||
    project.scenes[0]!.duration !== plan.sceneFields.duration ||
    JSON.stringify(project.actorGuide) !== JSON.stringify(plan.actorGuide)
  ) {
    throw new ConflictException(
      "Prepare the actor guide from the current 3D scene before sending this request.",
    );
  }
  return revision.id;
}
