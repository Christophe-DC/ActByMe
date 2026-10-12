import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@actbyme/database";

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
  return revision.id;
}
