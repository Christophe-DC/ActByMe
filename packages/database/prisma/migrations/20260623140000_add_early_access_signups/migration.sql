CREATE TABLE "EarlyAccessSignup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarlyAccessSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EarlyAccessSignup_email_key" ON "EarlyAccessSignup"("email");
CREATE INDEX "EarlyAccessSignup_createdAt_idx" ON "EarlyAccessSignup"("createdAt");
