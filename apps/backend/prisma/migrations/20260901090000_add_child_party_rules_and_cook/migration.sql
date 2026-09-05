ALTER TYPE "UserRoleEnum" ADD VALUE IF NOT EXISTS 'COOK';

ALTER TABLE "child_accesses"
  ADD COLUMN "extraHalfHourRate" DECIMAL(10,2),
  ADD COLUMN "siblingDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "party_packages"
  ADD COLUMN "includedChildren" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "maxChildren" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN "extraChildPrice" DECIMAL(10,2) NOT NULL DEFAULT 150,
  ADD COLUMN "externalFoodServiceFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "party_packages"
SET "duration" = 240,
    "includedChildren" = 15,
    "maxChildren" = 25,
    "extraChildPrice" = 150;

ALTER TABLE "reservations"
  ADD COLUMN "packageQuantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "externalFood" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "extraChildren" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extraChildrenAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "externalFoodFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

INSERT INTO "products" (
  "id", "name", "description", "price", "sku", "isActive",
  "trackInventory", "preparationStation", "createdAt", "updatedAt"
) VALUES
  ('prod-child-hour', 'Acceso infantil 1 hora', 'Tarifa base de acceso infantil', 99, 'NIN-60', true, false, 'NONE', NOW(), NOW()),
  ('prod-child-extra-30', '30 minutos adicionales', 'Bloque adicional de acceso infantil', 49, 'NIN-30-EXTRA', true, false, 'NONE', NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "price" = EXCLUDED."price",
  "isActive" = true,
  "deletedAt" = NULL,
  "updatedAt" = NOW();

INSERT INTO "settings" ("id", "branchId", "key", "value", "group", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."id", values."key", values."value", 'children', NOW(), NOW()
FROM "branches" b
CROSS JOIN (VALUES
  ('child_hourly_rate', '99'),
  ('child_extra_half_hour_rate', '49'),
  ('child_sibling_discount_percent', '15'),
  ('child_hourly_product_id', 'prod-child-hour'),
  ('child_extra_half_hour_product_id', 'prod-child-extra-30')
) AS values("key", "value")
ON CONFLICT ("branchId", "key") DO UPDATE SET
  "value" = EXCLUDED."value",
  "updatedAt" = NOW();
