CREATE TYPE "NotificationType" AS ENUM ('PERFORMANCE_REQUEST');

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT NOT NULL,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "emailSentAt" TIMESTAMP(3),
  "emailError" TEXT,
  "performanceAssignmentId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_performanceAssignmentId_type_key"
  ON "Notification"("performanceAssignmentId", "type");
CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_createdAt_idx"
  ON "Notification"("createdAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_performanceAssignmentId_fkey"
  FOREIGN KEY ("performanceAssignmentId") REFERENCES "PerformanceAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Notifications are served only through the authenticated Nest API. Keep the
-- table closed to direct Supabase Data API access as defense in depth.
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Notification" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Notification" FROM authenticated;
  END IF;
END
$$;
