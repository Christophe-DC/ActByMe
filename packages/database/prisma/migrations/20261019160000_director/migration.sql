-- CreateTable
CREATE TABLE "DirectorProject" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorRevision" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorAsset" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "hasAudio" BOOLEAN,
    "rights" JSONB NOT NULL,
    "aiTransferAllowed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorJob" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "shotId" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'En attente du worker',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL,
    "providerRequest" JSONB,
    "resultAssetId" UUID,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorWorker" (
    "id" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providers" JSONB NOT NULL,

    CONSTRAINT "DirectorWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorActorGrant" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "scopeHash" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorActorGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectorProject_ownerId_updatedAt_idx" ON "DirectorProject"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorRevision_projectId_version_key" ON "DirectorRevision"("projectId", "version");

-- CreateIndex
CREATE INDEX "DirectorAsset_projectId_createdAt_idx" ON "DirectorAsset"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectorJob_status_nextRunAt_leaseUntil_idx" ON "DirectorJob"("status", "nextRunAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "DirectorJob_projectId_createdAt_idx" ON "DirectorJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectorJob_ownerId_createdAt_idx" ON "DirectorJob"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorJob_ownerId_requestKey_key" ON "DirectorJob"("ownerId", "requestKey");

-- CreateIndex
CREATE INDEX "DirectorActorGrant_actorProfileId_createdAt_idx" ON "DirectorActorGrant"("actorProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorActorGrant_projectId_actorProfileId_scopeHash_key" ON "DirectorActorGrant"("projectId", "actorProfileId", "scopeHash");

-- AddForeignKey
ALTER TABLE "DirectorProject" ADD CONSTRAINT "DirectorProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorRevision" ADD CONSTRAINT "DirectorRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DirectorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorAsset" ADD CONSTRAINT "DirectorAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DirectorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorJob" ADD CONSTRAINT "DirectorJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DirectorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorActorGrant" ADD CONSTRAINT "DirectorActorGrant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DirectorProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorActorGrant" ADD CONSTRAINT "DirectorActorGrant_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the server DB role can access these records. No public Data API policies.
ALTER TABLE "DirectorProject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectorRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectorAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectorJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectorWorker" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DirectorActorGrant" ENABLE ROW LEVEL SECURITY;
