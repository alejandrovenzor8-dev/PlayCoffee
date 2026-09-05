import { BadRequestException } from '@nestjs/common';
import { OrderStatus, TableStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const product = {
    id: 'product-1',
    name: 'Latte',
    price: 55,
    isActive: true,
    modifiers: [
      {
        modifier: {
          id: 'modifier-1',
          name: 'Leche de avena',
          price: 10,
          isActive: true,
          deletedAt: null,
        },
      },
    ],
  };

  function setup() {
    const tx = {
      restaurantTable: {
        findFirst: jest.fn().mockResolvedValue({ id: 'table-1' }),
        update: jest.fn().mockResolvedValue({ id: 'table-1' }),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([product]),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'order-1',
            ...data,
            total: Number(data.total),
            items: [{ id: 'item-1' }],
          }),
        ),
      },
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const inventory = {
      discountOrderStock: jest.fn(),
      reverseOrderStock: jest.fn(),
    };
    const print = { queueProductionTickets: jest.fn().mockResolvedValue([]) };
    const service = new OrdersService(
      prisma as never,
      audit as never,
      inventory as never,
      print as never,
    );

    return { service, prisma, tx, audit };
  }

  it('creates the order and occupies its table in one transaction', async () => {
    const { service, prisma, tx, audit } = setup();

    const order = await service.create(
      {
        branchId: 'branch-1',
        tableId: 'table-1',
        items: [
          {
            productId: 'product-1',
            quantity: 2,
            modifiers: [{ modifierId: 'modifier-1', quantity: 1 }],
          },
        ],
      },
      'user-1',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: 'branch-1',
          subtotal: 130,
          total: 130,
          status: OrderStatus.PENDING,
          orderNumber: expect.stringMatching(/^PC-[A-Z0-9]+-[A-F0-9]{6}$/),
        }),
      }),
    );
    expect(tx.restaurantTable.update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { status: TableStatus.OCCUPIED },
    });
    expect(order.id).toBe('order-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'order-1', branchId: 'branch-1' }),
    );
  });

  it('rejects a modifier that is not assigned to the product', async () => {
    const { service, tx, audit } = setup();

    await expect(
      service.create(
        {
          branchId: 'branch-1',
          items: [
            {
              productId: 'product-1',
              quantity: 1,
              modifiers: [{ modifierId: 'modifier-other', quantity: 1 }],
            },
          ],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a table from another branch before creating the order', async () => {
    const { service, tx } = setup();
    tx.restaurantTable.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          branchId: 'branch-1',
          tableId: 'foreign-table',
          items: [],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.product.findMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
