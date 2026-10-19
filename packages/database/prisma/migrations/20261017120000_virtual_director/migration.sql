-- CreateTable
CREATE TABLE "VirtualDirector" (
    "projectId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "scene" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualDirector_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "VirtualDirectorReference" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "hasAudio" BOOLEAN,
    "rights" JSONB NOT NULL,
    "sourceTakeId" UUID,
    "sourceAttemptId" UUID,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualDirectorReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualDirectorJob" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "referenceId" UUID,
    "requestKey" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "shotId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'QUEUED',
    "input" JSONB NOT NULL,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "cleanedAt" TIMESTAMP(3),
    "providerRequest" JSONB,
    "outputKey" TEXT,
    "error" TEXT,
    "token" UUID,
    "leaseUntil" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VirtualDirectorJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualDirectorWorker" (
    "id" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blender" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VirtualDirectorWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VirtualDirectorReference_projectId_createdAt_idx" ON "VirtualDirectorReference"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "VirtualDirectorJob_status_nextRunAt_idx" ON "VirtualDirectorJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "VirtualDirectorJob_projectId_createdAt_idx" ON "VirtualDirectorJob"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualDirectorJob_projectId_requestKey_key" ON "VirtualDirectorJob"("projectId", "requestKey");

-- AddForeignKey
ALTER TABLE "VirtualDirector" ADD CONSTRAINT "VirtualDirector_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualDirectorReference" ADD CONSTRAINT "VirtualDirectorReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualDirectorJob" ADD CONSTRAINT "VirtualDirectorJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualDirectorJob" ADD CONSTRAINT "VirtualDirectorJob_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "VirtualDirectorReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only the server database role accesses production assets/jobs.
ALTER TABLE "VirtualDirector" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VirtualDirectorReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VirtualDirectorJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VirtualDirectorWorker" ENABLE ROW LEVEL SECURITY;
-- Serialize active work even if callers race with different request keys.
CREATE UNIQUE INDEX "VirtualDirectorJob_active_shot" ON "VirtualDirectorJob" ("projectId", "kind", "shotId")
WHERE "status" IN ('QUEUED', 'PROCESSING', 'SUBMITTING', 'WAITING_PROVIDER') AND "shotId" IS NOT NULL;
