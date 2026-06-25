CREATE TYPE "ChildAccessMode" AS ENUM ('HOURLY', 'FREE');
CREATE TYPE "ChildAccessStatus" AS ENUM ('ACTIVE', 'WARNING', 'GRACE', 'OVERTIME', 'COMPLETED');

ALTER TABLE "child_accesses"
  ADD COLUMN "accessMode" "ChildAccessMode" NOT NULL DEFAULT 'HOURLY',
  ADD COLUMN "accessCode" TEXT,
  ADD COLUMN "contractedMinutes" INTEGER,
  ADD COLUMN "warningMinutes" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "graceMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "hourlyRate" DECIMAL(10, 2),
  ADD COLUMN "freePrice" DECIMAL(10, 2),
  ADD COLUMN "baseAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "extraAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ChildAccessStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "child_accesses"
SET
  "accessCode" = UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 6)),
  "contractedMinutes" = "maxDuration",
  "status" = CASE WHEN "exitTime" IS NULL THEN 'ACTIVE'::"ChildAccessStatus" ELSE 'COMPLETED'::"ChildAccessStatus" END;

ALTER TABLE "child_accesses"
  ALTER COLUMN "accessCode" SET NOT NULL;

CREATE UNIQUE INDEX "child_accesses_accessCode_key" ON "child_accesses"("accessCode");
CREATE INDEX "child_accesses_branchId_status_idx" ON "child_accesses"("branchId", "status");
