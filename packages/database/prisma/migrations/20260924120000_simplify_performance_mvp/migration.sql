CREATE TYPE "PerformanceAssignmentStatus" AS ENUM (
  'SELECTED',
  'ACCEPTED',
  'SUBMITTED',
  'QA_RUNNING',
  'QA_PASSED',
  'QA_FAILED'
);

ALTER TABLE "PerformanceProject"
  ADD COLUMN "script" TEXT,
  ADD COLUMN "actorGuide" JSONB,
  ADD COLUMN "aiEnginePrompt" TEXT,
  ADD COLUMN "outputsBriefVersion" INTEGER;

ALTER TABLE "PerformanceScene"
  ADD COLUMN "emotionalProgression" TEXT,
  ADD COLUMN "startingPosition" TEXT;

CREATE TABLE "PerformanceAssignment" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "actorProfileId" UUID NOT NULL,
  "status" "PerformanceAssignmentStatus" NOT NULL DEFAULT 'SELECTED',
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerformanceAssignment_projectId_key"
  ON "PerformanceAssignment"("projectId");
CREATE INDEX "PerformanceAssignment_actorProfileId_status_idx"
  ON "PerformanceAssignment"("actorProfileId", "status");
CREATE INDEX "PerformanceAssignment_status_idx"
  ON "PerformanceAssignment"("status");

ALTER TABLE "PerformanceAssignment"
  ADD CONSTRAINT "PerformanceAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceAssignment"
  ADD CONSTRAINT "PerformanceAssignment_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
