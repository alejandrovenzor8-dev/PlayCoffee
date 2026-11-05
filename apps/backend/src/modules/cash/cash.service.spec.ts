import { CashService } from './cash.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Cash closing reminders', () => {
  const findFirst = jest.fn();
  const service = new CashService({
    shift: { findFirst },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-31T05:30:00Z'));
    findFirst.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('does not warn when there is no open shift', async () => {
    findFirst.mockResolvedValue(null);
    expect(await service.getClosingReminder('branch-a')).toBeNull();
    expect(findFirst.mock.calls[0][0].where).toEqual({
      branchId: 'branch-a',
      closedAt: null,
    });
  });

  it('uses the branch day, not UTC or the device timezone', async () => {
    findFirst.mockResolvedValue({
      id: 'shift-1',
      openedAt: new Date('2026-10-30T14:00:00Z'),
      branch: { timezone: 'America/Mexico_City' },
    });
    expect(await service.getClosingReminder('branch-a')).toMatchObject({
      shiftId: 'shift-1',
      fromPreviousDay: false,
    });
    jest.setSystemTime(new Date('2026-10-31T06:01:00Z'));
    expect(await service.getClosingReminder('branch-a')).toMatchObject({
      fromPreviousDay: true,
    });
  });

  it('does not allow a missing branch to select another branch shift', async () => {
    await expect(service.getClosingReminder('')).rejects.toThrow('branchId');
    expect(findFirst).not.toHaveBeenCalled();
  });
});
