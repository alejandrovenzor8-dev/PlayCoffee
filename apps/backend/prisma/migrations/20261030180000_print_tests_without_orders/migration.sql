-- Allow diagnostic prints without creating a sale or changing cash/inventory.
ALTER TABLE "print_jobs" ALTER COLUMN "orderId" DROP NOT NULL;
