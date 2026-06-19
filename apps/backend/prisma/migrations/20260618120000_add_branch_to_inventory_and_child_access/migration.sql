-- Add branch ownership to inventory and child access records.
-- Existing development/demo rows are assigned to the seeded default branch.

ALTER TABLE "inventory_items" ADD COLUMN "branchId" TEXT;
ALTER TABLE "child_accesses" ADD COLUMN "branchId" TEXT;

UPDATE "inventory_items"
SET "branchId" = 'branch-1'
WHERE "branchId" IS NULL;

UPDATE "child_accesses"
SET "branchId" = 'branch-1'
WHERE "branchId" IS NULL;

ALTER TABLE "inventory_items" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "child_accesses" ALTER COLUMN "branchId" SET NOT NULL;

CREATE INDEX "inventory_items_branchId_idx" ON "inventory_items"("branchId");
CREATE INDEX "child_accesses_branchId_idx" ON "child_accesses"("branchId");

ALTER TABLE "inventory_items"
ADD CONSTRAINT "inventory_items_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "child_accesses"
ADD CONSTRAINT "child_accesses_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
