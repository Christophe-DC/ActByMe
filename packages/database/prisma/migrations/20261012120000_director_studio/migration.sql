-- AlterTable
ALTER TABLE "PerformanceAssignment" ADD COLUMN     "studioRevisionId" UUID;

-- CreateTable
CREATE TABLE "DirectorStudio" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorStudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorStudioRevision" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "scene" JSONB NOT NULL,
    "instructions" TEXT NOT NULL,
    "roleId" TEXT,
    "inputHash" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "model" TEXT,
    "responseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorStudioRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorStudioJob" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "token" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorStudioJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectorStudio_projectId_key" ON "DirectorStudio"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorStudioRevision_studioId_version_key" ON "DirectorStudioRevision"("studioId", "version");

-- CreateIndex
CREATE INDEX "DirectorStudioJob_status_createdAt_idx" ON "DirectorStudioJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PerformanceAssignment" ADD CONSTRAINT "PerformanceAssignment_studioRevisionId_fkey" FOREIGN KEY ("studioRevisionId") REFERENCES "DirectorStudioRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorStudio" ADD CONSTRAINT "DirectorStudio_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorStudioRevision" ADD CONSTRAINT "DirectorStudioRevision_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "DirectorStudio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorStudioJob" ADD CONSTRAINT "DirectorStudioJob_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "DirectorStudio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
