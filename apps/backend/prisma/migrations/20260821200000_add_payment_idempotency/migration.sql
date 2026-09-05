ALTER TABLE "payments" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
