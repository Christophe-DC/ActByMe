-- CreateEnum
CREATE TYPE "PerformancePath" AS ENUM ('MATCHED_ACTOR', 'INVITED_ACTOR', 'SELF_UPLOAD');

-- CreateEnum
CREATE TYPE "PerformanceWorkflowStatus" AS ENUM ('COMPANY_DETAILS', 'PROJECT_DETAILS', 'SETUP_REVIEW', 'BRIEF_PROCESSING', 'BRIEF_READY', 'PERFORMANCE_SOURCE', 'ACTOR_SELECTION', 'REQUEST_SUMMARY', 'PERFORMANCE_PROGRESS', 'QA_PENDING', 'CLIENT_REVIEW', 'APPROVED_DELIVERY');

-- CreateTable
CREATE TABLE "PerformanceProject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objective" TEXT,
    "location" TEXT,
    "targetAiTool" TEXT,
    "language" TEXT,
    "notes" TEXT,
    "sourceFileName" TEXT,
    "companyName" TEXT NOT NULL,
    "companyWebsite" TEXT,
    "organizationType" TEXT,
    "contactName" TEXT,
    "contactRole" TEXT,
    "performerPath" "PerformancePath",
    "workflowStatus" "PerformanceWorkflowStatus" NOT NULL DEFAULT 'COMPANY_DETAILS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceBrief" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "talentRequirements" JSONB NOT NULL,
    "capturePlan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceScene" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "duration" TEXT,
    "referenceUrl" TEXT,
    "dialogue" TEXT,
    "direction" TEXT,
    "bodyPosition" TEXT,
    "eyeline" TEXT,
    "gestures" TEXT,
    "framing" TEXT,
    "uploadedFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceScene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceProject_ownerId_updatedAt_idx" ON "PerformanceProject"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "PerformanceProject_workflowStatus_idx" ON "PerformanceProject"("workflowStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceBrief_projectId_key" ON "PerformanceBrief"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceScene_projectId_position_key" ON "PerformanceScene"("projectId", "position");

-- CreateIndex
CREATE INDEX "PerformanceScene_projectId_idx" ON "PerformanceScene"("projectId");

-- AddForeignKey
ALTER TABLE "PerformanceProject" ADD CONSTRAINT "PerformanceProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceBrief" ADD CONSTRAINT "PerformanceBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceScene" ADD CONSTRAINT "PerformanceScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
