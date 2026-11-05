BEGIN;

-- Existing lines have unknown dispatch history. Never automatically resend them.
ALTER TABLE "order_items" ADD COLUMN "preparationStatus" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "preparationJobId" TEXT,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "printedAt" TIMESTAMP(3);
ALTER TABLE "order_items" ALTER COLUMN "preparationStatus" SET DEFAULT 'PENDING';

-- Fail safely if pre-existing duplicate active orders require operator reconciliation.
-- No orders or payments are deleted or automatically merged.
CREATE UNIQUE INDEX "orders_one_active_per_table" ON "orders" ("tableId")
WHERE "tableId" IS NOT NULL AND "deletedAt" IS NULL
  AND "status" NOT IN ('COMPLETED', 'CANCELLED');

ALTER TABLE "orders" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "orders_requestId_key" ON "orders"("requestId");
ALTER TABLE "child_accesses" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "child_accesses_requestId_key" ON "child_accesses"("requestId");
CREATE TABLE "order_submissions" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
