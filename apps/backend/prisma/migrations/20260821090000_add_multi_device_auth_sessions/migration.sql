CREATE TABLE "public"."auth_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "deviceName" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_sessions_userId_revokedAt_idx"
  ON "public"."auth_sessions"("userId", "revokedAt");

CREATE INDEX "auth_sessions_expiresAt_idx"
  ON "public"."auth_sessions"("expiresAt");

ALTER TABLE "public"."auth_sessions"
  ADD CONSTRAINT "auth_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
