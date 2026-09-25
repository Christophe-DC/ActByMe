-- Preserve the provenance of AI-generated outputs without changing existing rows.
ALTER TABLE "PerformanceProject"
ADD COLUMN IF NOT EXISTS "outputsGeneratedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "outputsModel" TEXT,
ADD COLUMN IF NOT EXISTS "outputsProvider" TEXT,
ADD COLUMN IF NOT EXISTS "outputsResponseId" TEXT;
