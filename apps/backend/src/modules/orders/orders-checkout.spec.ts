import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('Checkout corrections and unpaid account cleanup', () => {
  const line = () => ({
    id: 'line',
    productId: 'water',
    quantity: 2,
    unitPrice: 25,
    totalPrice: 50,
    status: 'PENDING',
    preparationStatus: 'PENDING',
    preparationJobId: null,
    notes: 'Natural',
    product: { name: 'Agua', preparationStation: 'NONE' },
    modifiers: [],
  });
  const fixture = () => ({
    id: 'order',
    branchId: 'branch',
    tableId: null,
    orderNumber: 'PC-OLD',
    status: 'PENDING',
    inventoryDiscountedAt: null,
    subtotal: 100,
    taxAmount: 0,
    tipAmount: 0,
    discountAmount: 0,
    total: 100,
    payments: [],
    items: [line()],
  });
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    order: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'order', status: 'CANCELLED' }),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'order', items: [] }),
    },
    childAccess: { count: jest.fn().mockResolvedValue(0) },
    printJob: { findUnique: jest.fn() },
    orderItem: {
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'replacement' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const queueCancellation = jest.fn().mockResolvedValue(undefined);
  const service = new OrdersService(
    {
      $transaction: (fn: (client: unknown) => Promise<unknown>) => fn(tx),
    } as never,
    {} as never,
    {} as never,
    { queueCancellation } as never,
  );
  const cancel = (confirmed = true, reason = 'Cuenta antigua sin cobrar') =>
    service.cancelUnpaid('order', { confirmed, reason }, 'branch', 'cashier');
  beforeEach(() => {
    jest.clearAllMocks();
    tx.order.findFirst.mockResolvedValue(fixture());
    tx.childAccess.count.mockResolvedValue(0);
  });

  it('requires confirmation and a real reason before making changes', async () => {
    await expect(cancel(false)).rejects.toBeInstanceOf(BadRequestException);
    await expect(cancel(true, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.order.findFirst).not.toHaveBeenCalled();
  });
  it('cancels an old unpaid account and keeps an audit trail instead of deleting records', async () => {
    await cancel();
    expect(tx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order', branchId: 'branch', deletedAt: null },
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'cashier',
          action: 'UNPAID_ORDER_CANCELLED',
          metadata: expect.objectContaining({
            reason: 'Cuenta antigua sin cobrar',
          }),
        }),
      }),
    );
  });
  it.each(['COMPLETED', 'PENDING', 'REFUNDED'])(
    'protects accounts with %s payments',
    async (status) => {
      tx.order.findFirst.mockResolvedValue({
        ...fixture(),
        payments: [{ status }],
      });
      await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
      expect(tx.order.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    { tableId: 'table' },
    { status: 'COMPLETED' },
    { status: 'CANCELLED' },
    { inventoryDiscountedAt: new Date() },
  ])('rejects accounts outside the cleanup scope %j', async (override) => {
    tx.order.findFirst.mockResolvedValue({ ...fixture(), ...override });
    await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.update).not.toHaveBeenCalled();
  });
  it('does not discard an active child access', async () => {
    tx.childAccess.count.mockResolvedValue(1);
    await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.update).not.toHaveBeenCalled();
  });
  it('cannot cancel a missing account or an account of another branch', async () => {
    tx.order.findFirst.mockResolvedValue(null);
    await expect(cancel()).rejects.toBeInstanceOf(NotFoundException);
  });
  it('notifies the preparation station for previously sent products', async () => {
    tx.order.findFirst.mockResolvedValue({
      ...fixture(),
      items: [
        {
          ...line(),
          preparationStatus: 'SENT',
          product: { preparationStation: 'KITCHEN' },
        },
      ],
    });
    await cancel();
    expect(queueCancellation).toHaveBeenCalledWith(
      tx,
      'order',
      'branch',
      'line',
      'Cuenta antigua sin cobrar',
    );
  });
  it('waits for in-flight preparation jobs before cancelling', async () => {
    tx.order.findFirst.mockResolvedValue({
      ...fixture(),
      items: [
        { ...line(), preparationStatus: 'QUEUED', preparationJobId: 'job' },
      ],
    });
    tx.printJob.findUnique.mockResolvedValue({ status: 'PROCESSING' });
    await expect(cancel()).rejects.toBeInstanceOf(ConflictException);
    expect(queueCancellation).not.toHaveBeenCalled();
  });
  it('removes a wrongly entered product and recalculates the total without losing its history', async () => {
    await service.correctItem(
      'order',
      'line',
      { quantity: 0, reason: 'Producto incorrecto' },
      'branch',
      'cashier',
      UserRoleEnum.CASHIER,
    );
    expect(tx.orderItem.update).toHaveBeenCalledWith({
      where: { id: 'line' },
      data: { status: 'CANCELLED' },
    });
    expect(tx.orderItem.create).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order' },
      data: { subtotal: 50, total: 50 },
    });
  });
  it('reduces a quantity with a replacement line at the original price', async () => {
    await service.correctItem(
      'order',
      'line',
      { quantity: 1, reason: 'Cantidad incorrecta' },
      'branch',
      'cashier',
      UserRoleEnum.CASHIER,
    );
    expect(tx.orderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: 1,
          unitPrice: 25,
          totalPrice: 25,
        }),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order' },
      data: { subtotal: 75, total: 75 },
    });
  });
  it('does not remove child-access charges from checkout', async () => {
    tx.childAccess.count.mockResolvedValue(1);
    await expect(
      service.correctItem(
        'order',
        'line',
        { quantity: 0, reason: 'No corresponde' },
        'branch',
        'cashier',
        UserRoleEnum.CASHIER,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.orderItem.update).not.toHaveBeenCalled();
  });
});
