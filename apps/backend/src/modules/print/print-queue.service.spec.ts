import { ConflictException } from '@nestjs/common';
import { PrintJobStatus } from '@prisma/client';
import { PrintService } from './print.service';

describe('PrintService queue', () => {
  const printJob = {
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const orderItem = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const db = { printJob, orderItem };
  const service = new PrintService({
    ...db,
    $transaction: (callback: (tx: typeof db) => unknown) => callback(db),
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it('claims one pending job for a specific agent', async () => {
    printJob.updateMany
      .mockResolvedValueOnce({ count: 0 }) // stale claim cleanup
      .mockResolvedValueOnce({ count: 1 });
    printJob.findFirst.mockResolvedValue({ id: 'job-1' });
    printJob.findUnique.mockResolvedValue({
      id: 'job-1',
      claimedBy: 'agent-a',
    });

    await expect(service.claimNextJob('agent-a')).resolves.toMatchObject({
      id: 'job-1',
      claimedBy: 'agent-a',
    });
    expect(printJob.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', status: PrintJobStatus.PENDING },
        data: expect.objectContaining({ claimedBy: 'agent-a' }),
      }),
    );
  });

  it('marks an owned job as printed', async () => {
    printJob.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.completeJob('job-1', 'agent-a')).resolves.toEqual({
      id: 'job-1',
      status: PrintJobStatus.PRINTED,
    });
  });

  it('rejects completion from an agent that does not own the job', async () => {
    printJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.completeJob('job-1', 'agent-b'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a failed job to the queue while attempts remain', async () => {
    printJob.findFirst.mockResolvedValue({
      id: 'job-1',
      attempts: 2,
      maxAttempts: 8,
    });
    printJob.update.mockResolvedValue({
      id: 'job-1',
      status: PrintJobStatus.PENDING,
    });
    await expect(
      service.failJob('job-1', 'agent-a', 'sin papel'),
    ).resolves.toMatchObject({
      status: PrintJobStatus.PENDING,
    });
    expect(printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PrintJobStatus.PENDING,
          lastError: 'sin papel',
        }),
      }),
    );
  });
});
