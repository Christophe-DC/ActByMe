ALTER TYPE "PerformanceTakeStatus" ADD VALUE IF NOT EXISTS 'QA_RUNNING';
ALTER TYPE "PerformanceTakeStatus" ADD VALUE IF NOT EXISTS 'QA_FAILED';
ALTER TYPE "PerformanceTakeStatus" ADD VALUE IF NOT EXISTS 'QA_PASSED';
ALTER TYPE "PerformanceTakeStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

CREATE TYPE "PerformanceQaRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'ERROR');
CREATE TYPE "PerformanceQaResultStatus" AS ENUM ('PASS', 'FAIL');
CREATE TYPE "PerformanceQaCheckType" AS ENUM (
  'FILE_CODEC',
  'DURATION',
  'RESOLUTION_ORIENTATION',
  'AUDIO_PRESENCE',
  'DIALOGUE_ACCURACY'
);

CREATE TABLE "PerformanceQaRun" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "takeId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "sceneId" UUID NOT NULL,
  "uploadAttemptId" UUID NOT NULL,
  "approvedBriefVersion" INTEGER NOT NULL,
  "status" "PerformanceQaRunStatus" NOT NULL DEFAULT 'RUNNING',
  "result" "PerformanceQaResultStatus",
  "transcript" TEXT,
  "transcriptionModel" TEXT,
  "processingError" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceQaRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceQaCheckResult" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "qaRunId" UUID NOT NULL,
  "type" "PerformanceQaCheckType" NOT NULL,
  "result" "PerformanceQaResultStatus" NOT NULL,
  "requiredValue" JSONB,
  "measuredValue" JSONB NOT NULL,
  "correctionInstruction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceQaCheckResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerformanceQaRun_takeId_createdAt_idx" ON "PerformanceQaRun"("takeId", "createdAt");
CREATE INDEX "PerformanceQaRun_projectId_idx" ON "PerformanceQaRun"("projectId");
CREATE INDEX "PerformanceQaRun_sceneId_idx" ON "PerformanceQaRun"("sceneId");
CREATE INDEX "PerformanceQaRun_status_idx" ON "PerformanceQaRun"("status");
CREATE INDEX "PerformanceQaCheckResult_result_idx" ON "PerformanceQaCheckResult"("result");
CREATE UNIQUE INDEX "PerformanceQaCheckResult_qaRunId_type_key" ON "PerformanceQaCheckResult"("qaRunId", "type");

ALTER TABLE "PerformanceQaRun"
ADD CONSTRAINT "PerformanceQaRun_takeId_fkey"
FOREIGN KEY ("takeId") REFERENCES "PerformanceTake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceQaRun"
ADD CONSTRAINT "PerformanceQaRun_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceQaRun"
ADD CONSTRAINT "PerformanceQaRun_sceneId_fkey"
FOREIGN KEY ("sceneId") REFERENCES "PerformanceScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceQaCheckResult"
ADD CONSTRAINT "PerformanceQaCheckResult_qaRunId_fkey"
FOREIGN KEY ("qaRunId") REFERENCES "PerformanceQaRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
