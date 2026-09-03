ALTER TYPE "PerformancePath" RENAME TO "PerformancePath_legacy";

CREATE TYPE "PerformancePath" AS ENUM ('SELF', 'TEAM_MEMBER', 'ACTBYME_PERFORMER');

ALTER TABLE "PerformanceProject"
ALTER COLUMN "performerPath" TYPE "PerformancePath"
USING (
  CASE "performerPath"::text
    WHEN 'SELF_UPLOAD' THEN 'SELF'
    WHEN 'INVITED_ACTOR' THEN 'TEAM_MEMBER'
    WHEN 'MATCHED_ACTOR' THEN 'ACTBYME_PERFORMER'
    ELSE NULL
  END
)::"PerformancePath";

DROP TYPE "PerformancePath_legacy";

ALTER TYPE "PerformanceWorkflowStatus" ADD VALUE IF NOT EXISTS 'BRIEF_APPROVED';
ALTER TYPE "PerformanceWorkflowStatus" ADD VALUE IF NOT EXISTS 'PERFORMER_SELECTION';

ALTER TABLE "PerformanceBrief"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "approvedVersion" INTEGER,
ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "PerformanceBrief" AS brief
SET
  "approvedAt" = COALESCE(brief."updatedAt", brief."generatedAt"),
  "approvedVersion" = brief."version"
FROM "PerformanceProject" AS project
WHERE brief."projectId" = project."id"
  AND project."workflowStatus"::text IN (
    'PERFORMANCE_SOURCE',
    'ACTOR_SELECTION',
    'REQUEST_SUMMARY',
    'PERFORMANCE_PROGRESS',
    'QA_PENDING',
    'CLIENT_REVIEW',
    'APPROVED_DELIVERY'
  );
