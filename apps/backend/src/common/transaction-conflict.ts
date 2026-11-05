import { Prisma } from '@prisma/client';

// Raw row locks surface PostgreSQL serialization/deadlock errors as P2010,
// whereas Prisma writes usually report the same conflict as P2034.
export function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' ||
      (error.code === 'P2010' &&
        ['40001', '40P01'].includes(String(error.meta?.code))))
  );
}
