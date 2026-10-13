-- AlterTable
ALTER TABLE "DirectorStudioRevision" ADD COLUMN     "recordingPlan" JSONB;

-- AlterTable
ALTER TABLE "DirectorStudioShare" ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DirectorStudioComment" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "shareId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "time" DOUBLE PRECISION NOT NULL,
    "target" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectorStudioComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectorStudioComment_revisionId_createdAt_idx" ON "DirectorStudioComment"("revisionId", "createdAt");

-- AddForeignKey
ALTER TABLE "DirectorStudioComment" ADD CONSTRAINT "DirectorStudioComment_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DirectorStudioRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorStudioComment" ADD CONSTRAINT "DirectorStudioComment_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "DirectorStudioShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorStudioComment" ADD CONSTRAINT "DirectorStudioComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
