-- AlterTable
ALTER TABLE "DirectorStudio" ADD COLUMN     "draftInstructions" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "DirectorStudioRevision" ADD COLUMN     "label" TEXT NOT NULL DEFAULT 'Edited scene';

-- Preserve the saved direction for existing studios.
UPDATE "DirectorStudio" AS studio SET "draftInstructions" = COALESCE(
  (SELECT "instructions" FROM "DirectorStudioRevision" WHERE "studioId" = studio."id" ORDER BY "version" DESC LIMIT 1), ''
);

-- CreateTable
CREATE TABLE "DirectorStudioShare" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revisionId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorStudioShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectorStudioShare_tokenHash_key" ON "DirectorStudioShare"("tokenHash");

-- CreateIndex
CREATE INDEX "DirectorStudioShare_revisionId_createdAt_idx" ON "DirectorStudioShare"("revisionId", "createdAt");

-- AddForeignKey
ALTER TABLE "DirectorStudioShare" ADD CONSTRAINT "DirectorStudioShare_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DirectorStudioRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
