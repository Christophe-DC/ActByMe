-- DropForeignKey
ALTER TABLE "ActorSkill" DROP CONSTRAINT IF EXISTS "ActorSkill_actorId_fkey";

-- DropForeignKey
ALTER TABLE "ActorVideo" DROP CONSTRAINT IF EXISTS "ActorVideo_actorId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ActorSkill";

-- DropTable
DROP TABLE IF EXISTS "ActorVideo";

-- DropTable
DROP TABLE IF EXISTS "AccessRequest";

-- DropTable
DROP TABLE IF EXISTS "Actor";

-- DropEnum
DROP TYPE IF EXISTS "ActorSkillCategory";

-- DropEnum
DROP TYPE IF EXISTS "AccessRequestStatus";

-- DropEnum
DROP TYPE IF EXISTS "ActorProfileStatus";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACTOR', 'CLIENT');

-- CreateEnum
CREATE TYPE "ActorProfileStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('ACTING', 'VOICE', 'SINGING', 'DANCE', 'MARTIAL_ARTS', 'STUNTS', 'SPORTS', 'COMEDY', 'DRAMA', 'UGC_ADS', 'CORPORATE', 'BODY_MOVEMENT', 'EMOTIONAL_PERFORMANCE');

-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('INTRO', 'ACTING_TEST', 'MOTION_TEST', 'VOICE_SAMPLE', 'PORTFOLIO', 'BEFORE_AFTER_AI');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "AgencyRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ACTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "bio" TEXT,
    "country" TEXT,
    "city" TEXT,
    "profileImageUrl" TEXT,
    "heroVideoUrl" TEXT,
    "actAiScore" INTEGER,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "ActorProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorSkill" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "label" TEXT,
    "yearsExperience" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActorSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorLanguage" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActorLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorAccent" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "accent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActorAccent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorVideo" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "type" "VideoType" NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "durationSeconds" INTEGER,
    "skillCategory" "SkillCategory",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActorVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActorConsent" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "publicProfileConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingUsageConsent" BOOLEAN NOT NULL DEFAULT false,
    "ownsUploadedContentConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "futurePaidWorkRequiresSeparateApproval" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActorConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAccessRequest" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "needs" TEXT NOT NULL,
    "expectedMonthlyVolume" TEXT,
    "interestedSkills" TEXT[],
    "status" "AgencyRequestStatus" NOT NULL DEFAULT 'NEW',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoProfile" (
    "id" UUID NOT NULL,
    "actorProfileId" UUID NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Demo profile',
    "description" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "userId" UUID,
    "actorProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActorProfile_userId_key" ON "ActorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActorProfile_slug_key" ON "ActorProfile"("slug");

-- CreateIndex
CREATE INDEX "ActorProfile_slug_idx" ON "ActorProfile"("slug");

-- CreateIndex
CREATE INDEX "ActorProfile_status_idx" ON "ActorProfile"("status");

-- CreateIndex
CREATE INDEX "ActorProfile_isDemo_idx" ON "ActorProfile"("isDemo");

-- CreateIndex
CREATE INDEX "ActorProfile_createdAt_idx" ON "ActorProfile"("createdAt");

-- CreateIndex
CREATE INDEX "ActorSkill_category_idx" ON "ActorSkill"("category");

-- CreateIndex
CREATE INDEX "ActorSkill_actorProfileId_idx" ON "ActorSkill"("actorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ActorSkill_actorProfileId_category_label_key" ON "ActorSkill"("actorProfileId", "category", "label");

-- CreateIndex
CREATE INDEX "ActorLanguage_language_idx" ON "ActorLanguage"("language");

-- CreateIndex
CREATE INDEX "ActorLanguage_actorProfileId_idx" ON "ActorLanguage"("actorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ActorLanguage_actorProfileId_language_key" ON "ActorLanguage"("actorProfileId", "language");

-- CreateIndex
CREATE INDEX "ActorAccent_accent_idx" ON "ActorAccent"("accent");

-- CreateIndex
CREATE INDEX "ActorAccent_actorProfileId_idx" ON "ActorAccent"("actorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ActorAccent_actorProfileId_accent_key" ON "ActorAccent"("actorProfileId", "accent");

-- CreateIndex
CREATE INDEX "ActorVideo_type_idx" ON "ActorVideo"("type");

-- CreateIndex
CREATE INDEX "ActorVideo_visibility_idx" ON "ActorVideo"("visibility");

-- CreateIndex
CREATE INDEX "ActorVideo_skillCategory_idx" ON "ActorVideo"("skillCategory");

-- CreateIndex
CREATE INDEX "ActorVideo_actorProfileId_sortOrder_idx" ON "ActorVideo"("actorProfileId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ActorConsent_actorProfileId_key" ON "ActorConsent"("actorProfileId");

-- CreateIndex
CREATE INDEX "AgencyAccessRequest_status_idx" ON "AgencyAccessRequest"("status");

-- CreateIndex
CREATE INDEX "AgencyAccessRequest_createdAt_idx" ON "AgencyAccessRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DemoProfile_actorProfileId_key" ON "DemoProfile"("actorProfileId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorProfileId_idx" ON "AuditLog"("actorProfileId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ActorProfile" ADD CONSTRAINT "ActorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorSkill" ADD CONSTRAINT "ActorSkill_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorLanguage" ADD CONSTRAINT "ActorLanguage_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorAccent" ADD CONSTRAINT "ActorAccent_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorVideo" ADD CONSTRAINT "ActorVideo_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActorConsent" ADD CONSTRAINT "ActorConsent_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoProfile" ADD CONSTRAINT "DemoProfile_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES "ActorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
