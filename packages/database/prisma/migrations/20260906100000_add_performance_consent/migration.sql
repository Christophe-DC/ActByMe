CREATE TABLE "PerformanceConsent" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedBriefVersion" INTEGER NOT NULL,
    "performerName" TEXT,
    "performerEmail" TEXT,
    "usagePurpose" TEXT,
    "commercialUse" BOOLEAN,
    "aiTransformationAllowed" BOOLEAN,
    "modelTrainingAllowed" BOOLEAN,
    "territory" TEXT,
    "usageDuration" TEXT,
    "restrictions" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerformanceConsent_projectId_version_key"
ON "PerformanceConsent"("projectId", "version");

CREATE INDEX "PerformanceConsent_projectId_acceptedAt_idx"
ON "PerformanceConsent"("projectId", "acceptedAt");

ALTER TABLE "PerformanceConsent"
ADD CONSTRAINT "PerformanceConsent_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "PerformanceProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- A delivery completed before consent documentation existed must be reviewed again.
UPDATE "PerformanceProject"
SET
    "currentStep" = 'consent',
    "deliveryCompletedAt" = NULL,
    "workflowStatus" = 'QA_PENDING'
WHERE "deliveryCompletedAt" IS NOT NULL
   OR "workflowStatus" = 'APPROVED_DELIVERY';
