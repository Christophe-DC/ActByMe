-- CreateEnum
CREATE TYPE "ActorProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ActorSkillCategory" AS ENUM ('ACTING', 'VOICE', 'DANCE', 'MARTIAL_ARTS', 'STUNTS', 'SINGING', 'ACCENTS', 'MOTION');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Actor" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "profileImageUrl" TEXT,
    "websiteUrl" TEXT,
    "linkedinUrl" TEXT,
    "instagramUrl" TEXT,
    "status" "ActorProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorSkill" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "category" "ActorSkillCategory" NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActorSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorVideo" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "category" "ActorSkillCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "playbackUrl" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActorVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "useCase" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Actor_email_key" ON "Actor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_slug_key" ON "Actor"("slug");

-- CreateIndex
CREATE INDEX "Actor_status_idx" ON "Actor"("status");

-- CreateIndex
CREATE INDEX "Actor_createdAt_idx" ON "Actor"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActorSkill_actorId_category_key" ON "ActorSkill"("actorId", "category");

-- CreateIndex
CREATE INDEX "ActorVideo_actorId_sortOrder_idx" ON "ActorVideo"("actorId", "sortOrder");

-- CreateIndex
CREATE INDEX "ActorVideo_category_idx" ON "ActorVideo"("category");

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_createdAt_idx" ON "AccessRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "ActorSkill" ADD CONSTRAINT "ActorSkill_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorVideo" ADD CONSTRAINT "ActorVideo_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
