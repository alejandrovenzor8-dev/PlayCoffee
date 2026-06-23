ALTER TABLE "payments"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "receivedAmount" DECIMAL(10, 2);

CREATE INDEX "payments_userId_idx" ON "payments"("userId");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
