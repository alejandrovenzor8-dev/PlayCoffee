import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { ChildAccessService } from './child-access.service';
import { UpdateChildPricingDto } from './dto/update-child-pricing.dto';

describe('Child access pricing', () => {
  const settings = new Map<string, string>();
  const findActiveRecords = jest.fn<Promise<unknown[]>, []>();
  const db = {
    setting: {
      findMany: jest.fn(({ where }: { where: { branchId: string } }) =>
        [...settings]
          .filter(([key]) => key.startsWith(`${where.branchId}:`))
          .map(([key, value]) => ({ key: key.split(':')[1], value })),
      ),
      findFirst: jest.fn(({ where }: { where: { key: string } }) =>
        where.key.endsWith('product_id') ? { value: 'product' } : null,
      ),
      upsert: jest.fn(
        ({
          create,
        }: {
          create: { branchId: string; key: string; value: string };
        }) => {
          settings.set(`${create.branchId}:${create.key}`, create.value);
          return Promise.resolve(create);
        },
      ),
    },
    childAccess: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: findActiveRecords,
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          id: 'access',
          entryTime: new Date(),
          exitTime: null,
        }),
      ),
    },
    order: {
      create: jest.fn().mockResolvedValue({ id: 'order' }),
      findUnique: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    product: { findFirst: jest.fn().mockResolvedValue({ id: 'product' }) },
    orderItem: {
      create: jest.fn().mockResolvedValue({ id: 'item' }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: 0 } }),
    },
    $transaction: jest.fn((operation: unknown) =>
      typeof operation === 'function'
        ? (operation as (client: unknown) => Promise<unknown>)(db)
        : Promise.all(operation as Promise<unknown>[]),
    ),
  };
  const service = new ChildAccessService(
    db as never,
    { record: jest.fn() } as never,
    { emitOrderEvent: jest.fn(), emitChildAccessEvent: jest.fn() } as never,
  );

  beforeEach(() => {
    settings.clear();
    jest.clearAllMocks();
  });

  it('defaults to existing rates and saves decimal prices only for the selected branch', async () => {
    expect(await service.getPricing('a')).toEqual({
      hourlyRate: 99,
      extraHalfHourRate: 49,
    });
    await service.updatePricing('a', {
      hourlyRate: 120.5,
      extraHalfHourRate: 60.25,
    });
    expect(await service.getPricing('a')).toEqual({
      hourlyRate: 120.5,
      extraHalfHourRate: 60.25,
    });
    expect(await service.getPricing('b')).toEqual({
      hourlyRate: 99,
      extraHalfHourRate: 49,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('requires a branch before reading or saving prices', async () => {
    await expect(service.getPricing()).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.updatePricing(undefined, { hourlyRate: 1, extraHalfHourRate: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.setting.upsert).not.toHaveBeenCalled();
  });

  it.each([-1, 1.234, Infinity, NaN, 100000000, '99', null, undefined])(
    'rejects invalid price %s',
    async (value) => {
      const dto = Object.assign(new UpdateChildPricingDto(), {
        hourlyRate: value,
        extraHalfHourRate: value,
      });
      expect(await validate(dto)).toHaveLength(2);
    },
  );

  it('allows zero and prices with cents', async () => {
    const dto = Object.assign(new UpdateChildPricingDto(), {
      hourlyRate: 0,
      extraHalfHourRate: 50.25,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('charges new rates and keeps the original rates on an existing access', async () => {
    await service.updatePricing('a', {
      hourlyRate: 120.5,
      extraHalfHourRate: 60.25,
    });
    const original = await service.register(
      {
        branchId: 'a',
        childName: 'Leo',
        guardianName: 'Ana',
        contractedMinutes: 90,
      },
      'cashier',
    );
    expect(Number(original.baseAmount)).toBe(180.75);
    expect(Number(original.hourlyRate)).toBe(120.5);
    expect(Number(original.extraHalfHourRate)).toBe(60.25);
    expect(db.orderItem.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitPrice: 180.75,
          totalPrice: 180.75,
        }),
      }),
    );
    await service.updatePricing('a', {
      hourlyRate: 150,
      extraHalfHourRate: 75,
    });
    const next = await service.register(
      {
        branchId: 'a',
        childName: 'Sol',
        guardianName: 'Eva',
        contractedMinutes: 90,
      },
      'cashier',
    );
    expect(Number(next.baseAmount)).toBe(225);
    expect(Number(original.extraHalfHourRate)).toBe(60.25);
    expect(Number(original.hourlyRate)).toBe(120.5);
    findActiveRecords.mockResolvedValue([
      { ...original, entryTime: new Date(Date.now() - 106 * 60000) },
    ]);
    const [active] = await service.findActive('a');
    expect(active.calculatedExtraAmount).toBe(60.25);
    expect(active.calculatedTotalAmount).toBe(241);
  });
});
