ALTER TABLE "public"."child_accesses"
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "baseOrderItemId" TEXT,
  ADD COLUMN "extraOrderItemId" TEXT;

CREATE INDEX IF NOT EXISTS "child_accesses_branchId_idx" ON "public"."child_accesses"("branchId");
CREATE INDEX IF NOT EXISTS "child_accesses_orderId_idx" ON "public"."child_accesses"("orderId");
CREATE INDEX IF NOT EXISTS "child_accesses_baseOrderItemId_idx" ON "public"."child_accesses"("baseOrderItemId");
CREATE INDEX IF NOT EXISTS "child_accesses_extraOrderItemId_idx" ON "public"."child_accesses"("extraOrderItemId");
CREATE INDEX IF NOT EXISTS "child_accesses_status_idx" ON "public"."child_accesses"("status");

ALTER TABLE "public"."child_accesses"
  ADD CONSTRAINT "child_accesses_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."child_accesses"
  ADD CONSTRAINT "child_accesses_baseOrderItemId_fkey"
  FOREIGN KEY ("baseOrderItemId") REFERENCES "public"."order_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."child_accesses"
  ADD CONSTRAINT "child_accesses_extraOrderItemId_fkey"
  FOREIGN KEY ("extraOrderItemId") REFERENCES "public"."order_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
