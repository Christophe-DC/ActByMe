-- AlterTable
ALTER TABLE "VirtualDirectorReference" ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', now());

-- AlterTable
ALTER TABLE "VirtualDirectorJob" ALTER COLUMN "nextRunAt" SET DEFAULT timezone('UTC', now()),
ALTER COLUMN "createdAt" SET DEFAULT timezone('UTC', now());

-- AlterTable
ALTER TABLE "VirtualDirectorWorker" ALTER COLUMN "seenAt" SET DEFAULT timezone('UTC', now());
