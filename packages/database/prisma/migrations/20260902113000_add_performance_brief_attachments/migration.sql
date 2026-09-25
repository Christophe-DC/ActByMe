CREATE TYPE "PerformanceBriefAttachmentStatus" AS ENUM ('UPLOADING', 'PARSING', 'READY', 'FAILED');

CREATE TABLE "PerformanceBriefAttachment" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "uploadAttemptId" UUID NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" "PerformanceBriefAttachmentStatus" NOT NULL DEFAULT 'UPLOADING',
    "extractedText" TEXT,
    "extractionError" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceBriefAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerformanceBriefAttachment_projectId_key" ON "PerformanceBriefAttachment"("projectId");
CREATE INDEX "PerformanceBriefAttachment_status_idx" ON "PerformanceBriefAttachment"("status");

ALTER TABLE "PerformanceBriefAttachment" ADD CONSTRAINT "PerformanceBriefAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
