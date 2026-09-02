-- CreateEnum
CREATE TYPE "PerformanceTakeUploadStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "PerformanceTakeStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "PerformanceTake" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "uploadAttemptId" UUID NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadStatus" "PerformanceTakeUploadStatus" NOT NULL DEFAULT 'UPLOADING',
    "takeStatus" "PerformanceTakeStatus" NOT NULL DEFAULT 'DRAFT',
    "uploadError" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceTake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceTake_sceneId_key" ON "PerformanceTake"("sceneId");

-- CreateIndex
CREATE INDEX "PerformanceTake_projectId_idx" ON "PerformanceTake"("projectId");

-- CreateIndex
CREATE INDEX "PerformanceTake_uploadStatus_idx" ON "PerformanceTake"("uploadStatus");

-- CreateIndex
CREATE INDEX "PerformanceTake_takeStatus_idx" ON "PerformanceTake"("takeStatus");

-- AddForeignKey
ALTER TABLE "PerformanceTake" ADD CONSTRAINT "PerformanceTake_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceTake" ADD CONSTRAINT "PerformanceTake_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "PerformanceScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
