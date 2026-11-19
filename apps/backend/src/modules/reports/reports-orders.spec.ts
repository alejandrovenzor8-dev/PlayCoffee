import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('Orders listed by creation date in reports', () => {
  const db = {
    branch: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ timezone: 'America/Mexico_City' }),
    },
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ id: 'unpaid' }, { id: 'cancelled' }]),
    order: { findMany: jest.fn() },
  };
  const service = new ReportsService(db as never);
  beforeEach(() => {
    jest.clearAllMocks();
    const base = {
      createdAt: new Date(),
      table: null,
      user: { firstName: 'Ana', lastName: 'Caja' },
      total: 100,
      payments: [
        { status: 'COMPLETED', amount: 40 },
        { status: 'FAILED', amount: 100 },
      ],
      items: [
        {
          id: 'line',
          product: { name: 'Agua' },
          quantity: 2,
          totalPrice: 100,
          status: 'PENDING',
          notes: null,
        },
      ],
    };
    db.order.findMany.mockResolvedValue([
      { ...base, id: 'unpaid', orderNumber: 'PC-1', status: 'PENDING' },
      {
        ...base,
        id: 'cancelled',
        orderNumber: 'PC-2',
        status: 'CANCELLED',
        payments: [],
      },
    ]);
  });
  it('lists all statuses with products, paid amounts and outstanding balances', async () => {
    const result = await service.orderList(
      'branch',
      '2026-11-18',
      '2026-11-18',
    );
    expect(result.timezone).toBe('America/Mexico_City');
    expect(result.orders[0]).toMatchObject({
      id: 'unpaid',
      totalPaid: 40,
      remainingAmount: 60,
      responsible: 'Ana Caja',
      items: [{ name: 'Agua', quantity: 2 }],
    });
    expect(result.orders[1]).toMatchObject({
      status: 'CANCELLED',
      remainingAmount: 0,
    });
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 'branch',
          deletedAt: null,
          id: { in: ['unpaid', 'cancelled'] },
        },
      }),
    );
    const [sql, ...values] = db.$queryRaw.mock.calls[0] as unknown as [
      string[],
      ...string[],
    ];
    expect(sql.join('')).toContain("AT TIME ZONE 'UTC' AT TIME ZONE");
    expect(values).toEqual([
      'branch',
      'America/Mexico_City',
      '2026-11-18',
      '2026-11-18',
    ]);
  });
  it.each([
    ['2026-02-31', '2026-11-18'],
    ['2026-11-19', '2026-11-18'],
    ['not-a-date', '2026-11-18'],
  ])('rejects invalid ranges %s to %s', async (start, end) => {
    await expect(
      service.orderList('branch', start, end),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('requires a branch', async () => {
    await expect(
      service.orderList(undefined, '2026-11-18', '2026-11-18'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
