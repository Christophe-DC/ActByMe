-- AddEnumValues
ALTER TYPE "PerformanceWorkflowStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "PerformanceWorkflowStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_BRIEF';
ALTER TYPE "PerformanceWorkflowStatus" ADD VALUE IF NOT EXISTS 'GENERATING_BRIEF';
ALTER TYPE "PerformanceWorkflowStatus" ADD VALUE IF NOT EXISTS 'BRIEF_REVIEW';

-- AlterTable
ALTER TABLE "PerformanceProject"
ADD COLUMN "locationData" JSONB,
ADD COLUMN "currentStep" TEXT NOT NULL DEFAULT 'company';

ALTER TABLE "PerformanceProject"
ALTER COLUMN "workflowStatus" SET DEFAULT 'DRAFT';

ALTER TABLE "PerformanceBrief"
ADD COLUMN "globalDirection" TEXT NOT NULL DEFAULT '',
ADD COLUMN "qaCriteria" JSONB NOT NULL DEFAULT '[]'::JSONB,
ADD COLUMN "model" TEXT NOT NULL DEFAULT 'gpt-5.6-terra',
ADD COLUMN "openaiResponseId" TEXT,
ADD COLUMN "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PerformanceScene"
ADD COLUMN "captureRequirements" TEXT;

-- Remove the exact create-performance prototype record if it was persisted locally.
DELETE FROM "PerformanceProject"
WHERE "companyName" = 'Agentmov'
  AND "title" = 'Azure Residence virtual apartment campaign'
  AND "sourceFileName" = 'Azure_Residence_Demo_Brief.pdf';
