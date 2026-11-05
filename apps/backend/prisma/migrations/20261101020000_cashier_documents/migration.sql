-- Additive only: existing print jobs and paid orders are not rewritten.
ALTER TYPE "PrintJobStatus" ADD VALUE IF NOT EXISTS 'HELD';
ALTER TABLE "print_jobs" ADD COLUMN "dedupKey" TEXT;
CREATE UNIQUE INDEX "print_jobs_dedupKey_key" ON "print_jobs"("dedupKey");
