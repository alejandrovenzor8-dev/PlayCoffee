CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

ALTER TABLE "payments" ADD COLUMN "shiftId" TEXT;

ALTER TABLE "shifts"
  ADD COLUMN "expectedCash" DECIMAL(10, 2),
  ADD COLUMN "cashDifference" DECIMAL(10, 2),
  ADD COLUMN "totalSales" DECIMAL(10, 2),
  ADD COLUMN "totalCash" DECIMAL(10, 2),
  ADD COLUMN "totalCard" DECIMAL(10, 2),
  ADD COLUMN "totalTransfer" DECIMAL(10, 2),
  ADD COLUMN "totalIn" DECIMAL(10, 2),
  ADD COLUMN "totalOut" DECIMAL(10, 2);

CREATE TABLE "cash_movements" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_shiftId_idx" ON "payments"("shiftId");
CREATE INDEX "shifts_branchId_closedAt_idx" ON "shifts"("branchId", "closedAt");
CREATE INDEX "cash_movements_branchId_createdAt_idx" ON "cash_movements"("branchId", "createdAt");
CREATE INDEX "cash_movements_shiftId_idx" ON "cash_movements"("shiftId");

ALTER TABLE "payments" ADD CONSTRAINT "payments_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
