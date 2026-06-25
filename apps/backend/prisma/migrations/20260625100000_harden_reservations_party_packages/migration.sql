ALTER TABLE "public"."party_packages"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "minDeposit" DECIMAL(10, 2);

ALTER TABLE "public"."reservations"
  ADD COLUMN "areaId" TEXT,
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "endTime" TIMESTAMP(3),
  ADD COLUMN "depositAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "public"."reservations"
SET
  "endTime" = "reservedAt" + ("duration" || ' minutes')::interval,
  "depositAmount" = COALESCE("deposit", 0),
  "totalAmount" = COALESCE("deposit", 0);

CREATE INDEX "party_packages_branchId_idx" ON "public"."party_packages"("branchId");
CREATE INDEX "reservations_branchId_reservedAt_idx" ON "public"."reservations"("branchId", "reservedAt");
CREATE INDEX "reservations_branchId_areaId_reservedAt_idx" ON "public"."reservations"("branchId", "areaId", "reservedAt");
CREATE INDEX "reservations_status_idx" ON "public"."reservations"("status");

ALTER TABLE "public"."party_packages"
  ADD CONSTRAINT "party_packages_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."reservations"
  ADD CONSTRAINT "reservations_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "public"."table_areas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."reservations"
  ADD CONSTRAINT "reservations_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
