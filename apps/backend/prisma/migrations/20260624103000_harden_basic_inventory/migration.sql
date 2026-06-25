ALTER TABLE "products"
  ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "orders"
  ADD COLUMN "inventoryDiscountedAt" TIMESTAMP(3);

ALTER TABLE "inventory_movements"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "reason" TEXT;

CREATE UNIQUE INDEX "inventory_items_branchId_productId_key"
  ON "inventory_items"("branchId", "productId");
