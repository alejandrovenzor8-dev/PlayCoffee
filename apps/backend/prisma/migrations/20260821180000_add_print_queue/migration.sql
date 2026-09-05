CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'PRINTED', 'FAILED', 'CANCELLED');
CREATE TYPE "PrintJobType" AS ENUM ('CUSTOMER', 'KITCHEN', 'BAR');

CREATE TABLE "print_jobs" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "PrintJobType" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "printerTarget" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "printedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "print_jobs_status_nextAttemptAt_createdAt_idx" ON "print_jobs"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "print_jobs_branchId_createdAt_idx" ON "print_jobs"("branchId", "createdAt");
CREATE INDEX "print_jobs_orderId_type_idx" ON "print_jobs"("orderId", "type");
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
