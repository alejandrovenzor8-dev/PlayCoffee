CREATE TYPE "PreparationStation" AS ENUM ('KITCHEN', 'BAR', 'NONE');

ALTER TABLE "products"
  ADD COLUMN "preparationStation" "PreparationStation" NOT NULL DEFAULT 'NONE';
