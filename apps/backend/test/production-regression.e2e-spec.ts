import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { PaymentMethod, UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreateOrderItemDto } from '../src/modules/orders/dto/create-order.dto';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PrintService } from '../src/modules/print/print.service';
import { PrintTicketDocument } from '../src/modules/print/print.types';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ChildAccessService } from '../src/modules/child-access/child-access.service';
import { CashService } from '../src/modules/cash/cash.service';
import { TablesService } from '../src/modules/tables/tables.service';

const testUrl = process.env.TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
// Never infer the test target from DATABASE_URL (which may point to production).
suite('Production regressions with real PostgreSQL transactions', () => {
  let db: PrismaService;
  let orders: OrdersService;
  let print: PrintService;
  let payments: PaymentsService;
  let children: ChildAccessService;
  let cash: CashService;
  let tables: TablesService;
  let branchId: string;
  let userId: string;
  let tableId: string;
  let breakfast: string;
  let coffee: string;
  let pizza: string;
  let childProduct: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    db = new PrismaService();
    await db.$connect();
    const realtime = {
      emitOrderEvent: jest.fn(),
      emitPaymentEvent: jest.fn(),
      emitInventoryEvent: jest.fn(),
      emitChildAccessEvent: jest.fn(),
      emitTableEvent: jest.fn(),
    };
    const audit = new AuditService(db);
    print = new PrintService(db);
    orders = new OrdersService(
      db,
      audit,
      new InventoryService(db, realtime as never),
      print,
    );
    payments = new PaymentsService(db, audit, realtime as never, print);
    children = new ChildAccessService(db, audit, realtime as never);
    cash = new CashService(db);
    tables = new TablesService(db, audit, realtime as never);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  beforeEach(async () => {
    branchId = (
      await db.branch.create({
        data: {
          name: 'Regression ' + randomUUID(),
          timezone: 'America/Mexico_City',
        },
      })
    ).id;
    userId = (
      await db.user.create({
        data: {
          branchId,
          email: randomUUID() + '@regression.invalid',
          firstName: 'Ana',
          lastName: 'Mesera',
          passwordHash: 'not-a-login',
          role: 'CASHIER',
        },
      })
    ).id;
    const area = await db.tableArea.create({
      data: { branchId, name: 'Terraza' },
    });
    tableId = (
      await db.restaurantTable.create({
        data: { areaId: area.id, number: '2', capacity: 4 },
      })
    ).id;
    const product = async (
      name: string,
      price: number,
      preparationStation: 'KITCHEN' | 'BAR' | 'NONE',
    ) =>
      (await db.product.create({ data: { name, price, preparationStation } }))
        .id;
    breakfast = await product('Desayuno', 100, 'KITCHEN');
    coffee = await product('Café', 40, 'BAR');
    pizza = await product('Pizza', 150, 'KITCHEN');
    childProduct = await product('Acceso infantil', 99, 'NONE');
    await db.setting.createMany({
      data: [
        {
          branchId,
          group: 'print',
          key: 'printer_kitchen',
          value: 'file:///regression-kitchen',
        },
        {
          branchId,
          group: 'print',
          key: 'printer_bar',
          value: 'file:///regression-bar',
        },
        { branchId, group: 'print', key: 'auto_print_kitchen', value: 'false' },
        { branchId, group: 'print', key: 'auto_print_bar', value: 'false' },
        {
          branchId,
          group: 'print',
          key: 'auto_print_customer',
          value: 'false',
        },
        { branchId, key: 'child_hourly_product_id', value: childProduct },
        {
          branchId,
          key: 'child_extra_half_hour_product_id',
          value: childProduct,
        },
      ],
    });
    await cash.open(branchId, userId, { openingBalance: 100 });
  });

  const create = (
    items: CreateOrderItemDto[] = [
      { productId: breakfast, quantity: 2 },
      { productId: coffee, quantity: 2 },
    ],
  ) => orders.create({ branchId, tableId, items }, userId);
  const payload = (job: { payload: unknown } | null) =>
    job!.payload as PrintTicketDocument;
  const acknowledge = async (id: string) => {
    await db.printJob.update({
      where: { id },
      data: { status: 'PROCESSING', claimedBy: 'test-agent' },
    });
    return print.completeJob(id, 'test-agent');
  };
  const pay = (
    orderId: string,
    amount: number,
    method: PaymentMethod = 'CASH',
    key = randomUUID(),
  ) =>
    payments.create(
      { orderId, amount, method, idempotencyKey: key },
      userId,
      branchId,
    );

  it('1: first batch contains 2 breakfasts and 2 coffees, separated by station', async () => {
    const order = await create();
    expect(order.items.every((i) => i.preparationStatus === 'PENDING')).toBe(
      true,
    );
    const kitchen = await print.queueTicket(order.id, branchId, 'KITCHEN');
    const bar = await print.queueTicket(order.id, branchId, 'BAR');
    expect(payload(kitchen).items.map((i) => [i.name, i.quantity])).toEqual([
      ['Desayuno', 2],
    ]);
    expect(payload(bar).items.map((i) => [i.name, i.quantity])).toEqual([
      ['Café', 2],
    ]);
    const lines = await db.orderItem.findMany({ where: { orderId: order.id } });
    expect(
      lines.every(
        (i) => i.preparationStatus === 'QUEUED' && i.sentAt && !i.printedAt,
      ),
    ).toBe(true);
    await acknowledge(kitchen!.id);
    await acknowledge(bar!.id);
    expect(
      await db.orderItem.count({
        where: {
          orderId: order.id,
          preparationStatus: 'SENT',
          printedAt: { not: null },
        },
      }),
    ).toBe(2);
  });

  it('2: second batch prints ONLY 2 pizzas even when the order date does not change', async () => {
    const order = await create();
    await print.queueTicket(order.id, branchId, 'KITCHEN');
    await print.queueTicket(order.id, branchId, 'BAR');
    await orders.addItems(
      order.id,
      [{ productId: pizza, quantity: 2 }],
      branchId,
      userId,
    );
    const second = await print.queueTicket(order.id, branchId, 'KITCHEN');
    expect(payload(second).items.map((i) => [i.name, i.quantity])).toEqual([
      ['Pizza', 2],
    ]);
    expect(await print.queueTicket(order.id, branchId, 'BAR')).toBeNull();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).createdAt,
    ).toEqual(order.createdAt);
  });

  it('3: concurrent send and retries reserve each line in only one batch', async () => {
    const order = await create();
    const jobs = await Promise.all([
      print.queueTicket(order.id, branchId, 'KITCHEN'),
      print.queueTicket(order.id, branchId, 'KITCHEN'),
    ]);
    expect(jobs.filter(Boolean)).toHaveLength(1);
    expect(await print.queueTicket(order.id, branchId, 'KITCHEN')).toBeNull();
    expect(
      await db.printJob.count({
        where: { orderId: order.id, type: 'KITCHEN' },
      }),
    ).toBe(1);
  });

  it('4: failed send is not printed or automatically replayed; explicit reprint is audited and deduplicated', async () => {
    const order = await create();
    const job = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    await db.printJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', claimedBy: 'test-agent', attempts: 1 },
    });
    await print.failJob(job.id, 'test-agent', 'sin papel');
    expect(
      (await db.printJob.findUniqueOrThrow({ where: { id: job.id } })).status,
    ).toBe('FAILED');
    expect(
      (
        await db.orderItem.findFirstOrThrow({
          where: { preparationJobId: job.id },
        })
      ).printedAt,
    ).toBeNull();
    expect(await print.queueTicket(order.id, branchId, 'KITCHEN')).toBeNull();
    const reprints = await Promise.all([
      print.reprintBatch(job.id, branchId, userId, 'Papel repuesto'),
      print.reprintBatch(job.id, branchId, userId, 'Papel repuesto'),
    ]);
    expect(reprints[0]!.id).toBe(reprints[1]!.id);
    expect(payload(reprints[0]).dispatch?.kind).toBe('REPRINT');
    await acknowledge(reprints[0]!.id);
    expect(
      (
        await db.orderItem.findFirstOrThrow({
          where: { preparationJobId: reprints[0]!.id },
        })
      ).preparationStatus,
    ).toBe('SENT');
    expect(
      await db.auditLog.count({
        where: { entityId: job.id, action: 'PREPARATION_REPRINT' },
      }),
    ).toBe(1);
  });

  it('5: pending correction retains history, changes notes/quantity, removes products, recalculates total', async () => {
    let order = await create();
    order = await orders.correctItem(
      order.id,
      order.items[0].id,
      { quantity: 1, notes: 'Sin sal', reason: 'Error de captura' },
      branchId,
      userId,
      UserRoleEnum.WAITER,
    );
    expect(Number(order.total)).toBe(180);
    const corrected = order.items.find((i) => i.productId === breakfast)!;
    expect(corrected.notes).toBe('Sin sal');
    expect(corrected.preparationStatus).toBe('PENDING');
    order = await orders.correctItem(
      order.id,
      corrected.id,
      { quantity: 0, reason: 'Cliente cancela' },
      branchId,
      userId,
      UserRoleEnum.WAITER,
    );
    expect(Number(order.total)).toBe(80);
    expect(
      await db.orderItem.count({
        where: { orderId: order.id, status: 'CANCELLED' },
      }),
    ).toBe(2);
  });

  it('6: sent correction requires cashier, audits reason and enqueues cancellation snapshot before replacement', async () => {
    const order = await create();
    const job = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    await acknowledge(job.id);
    const item = order.items.find((i) => i.productId === breakfast)!;
    const change = { quantity: 1, notes: 'Sin sal', reason: 'Cliente corrige' };
    await expect(
      orders.correctItem(
        order.id,
        item.id,
        change,
        branchId,
        userId,
        UserRoleEnum.WAITER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const corrected = await orders.correctItem(
      order.id,
      item.id,
      change,
      branchId,
      userId,
      UserRoleEnum.CASHIER,
    );
    expect(Number(corrected.total)).toBe(180);
    const jobs = await db.printJob.findMany({
      where: { orderId: order.id, type: 'KITCHEN' },
    });
    const cancellation = jobs.find(
      (j) => payload(j).dispatch?.kind === 'CANCELLATION',
    )!;
    expect(payload(cancellation).items[0].quantity).toBe(2);
    expect(payload(cancellation).dispatch?.reason).toBe(change.reason);
    expect(
      await db.auditLog.count({
        where: { entityId: item.id, userId, action: 'ORDER_ITEM_CORRECTED' },
      }),
    ).toBe(1);
    const replacement = await print.queueTicket(order.id, branchId, 'KITCHEN');
    expect(
      payload(replacement).items.map((i) => [i.quantity, i.notes]),
    ).toEqual([[1, 'Sin sal']]);
  });

  it('7: complete payment frees table before delivery and a new order has a different ID and no old lines/payments', async () => {
    const original = await create();
    await pay(original.id, 280);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: original.id } })).status,
    ).toBe('COMPLETED');
    expect(
      (await db.restaurantTable.findUniqueOrThrow({ where: { id: tableId } }))
        .status,
    ).toBe('AVAILABLE');
    expect((await tables.findAll(branchId))[0].orders).toHaveLength(0);
    const next = await create([{ productId: pizza, quantity: 2 }]);
    expect(next.id).not.toBe(original.id);
    expect(next.items.map((i) => i.productId)).toEqual([pizza]);
    expect(next.payments).toHaveLength(0);
    expect((await tables.findAll(branchId))[0].orders[0].id).toBe(next.id);
    expect((await orders.findOne(original.id, branchId)).items).toHaveLength(2);
    await expect(
      orders.correctItem(
        original.id,
        original.items[0].id,
        { quantity: 0, reason: 'No permitido' },
        branchId,
        userId,
        UserRoleEnum.ADMIN,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('8: two devices opening table 2 create exactly one active order', async () => {
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.order.count({
        where: { tableId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
    ).toBe(1);
  });

  it('9: ticket snapshot includes waiter, table, area, order time, batch and branch timezone', async () => {
    const order = await create();
    const job = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    const doc = payload(job);
    expect(doc.config.businessName).toBe('PLAYCOFFEE');
    expect(doc.order).toMatchObject({
      table: '2',
      area: 'Terraza',
      waiter: 'Ana Mesera',
      timezone: 'America/Mexico_City',
      orderNumber: order.orderNumber,
    });
    expect(new Date(doc.order.createdAt)).toEqual(order.createdAt);
    expect(doc.dispatch?.batchId).toBe(job.id);
    expect(Number.isNaN(Date.parse(doc.dispatch!.sentAt!))).toBe(false);
  });

  it('10: child checkin creates/reuses active table order exactly once and blocks final payment until checkout adds extras', async () => {
    const dto = {
      branchId,
      tableId,
      requestId: randomUUID(),
      childName: 'Leo',
      guardianName: 'Tutor',
      contractedMinutes: 60,
    };
    const [child, retry] = await Promise.all([
      children.register(dto, userId),
      children.register(dto, userId),
    ]);
    expect(child.id).toBe(retry.id);
    const order = await orders.findOne(child.orderId!, branchId);
    expect(order.tableId).toBe(tableId);
    expect(order.items).toHaveLength(1);
    await expect(pay(order.id, 99)).rejects.toBeInstanceOf(ConflictException);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(0);
    await db.childAccess.update({
      where: { id: child.id },
      data: { entryTime: new Date(Date.now() - 80 * 60000) },
    });
    const result = await children.checkout(
      child.id,
      { accessCode: child.accessCode },
      branchId,
      userId,
    );
    expect(result.chargeOrderId).toBe(order.id);
    expect(result.access.exitTime).not.toBeNull();
    expect(result.chargeSummary.extraAmount).toBe(49);
    expect(Number((await orders.findOne(order.id, branchId)).total)).toBe(148);
    await pay(order.id, 148);
    expect(
      (await db.childAccess.findUniqueOrThrow({ where: { id: child.id } }))
        .orderId,
    ).toBe(order.id);
  });

  it('11: split payment, payment retry and cash closing preserve balances', async () => {
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    const key = randomUUID();
    expect((await pay(order.id, 40, 'CASH', key)).summary.paymentStatus).toBe(
      'PARTIALLY_PAID',
    );
    await pay(order.id, 40, 'CASH', key);
    expect(
      (await db.restaurantTable.findUniqueOrThrow({ where: { id: tableId } }))
        .status,
    ).toBe('OCCUPIED');
    expect((await pay(order.id, 60, 'CARD')).summary.paymentStatus).toBe(
      'PAID',
    );
    const closed = await cash.close(branchId, userId, { closingBalance: 140 });
    expect(closed).toMatchObject({
      totalSales: 100,
      totalCash: 40,
      totalCard: 60,
      expectedCash: 140,
      cashDifference: 0,
    });
  });

  it('12: creation/addition retries do not duplicate persisted lines', async () => {
    const requestId = randomUUID();
    const dto = {
      branchId,
      tableId,
      requestId,
      items: [{ productId: breakfast, quantity: 1 }],
    };
    const first = await orders.create(dto, userId);
    expect((await orders.create(dto, userId)).id).toBe(first.id);
    const addition = randomUUID();
    await Promise.all([
      orders.addItems(
        first.id,
        [{ productId: pizza, quantity: 2 }],
        branchId,
        userId,
        addition,
      ),
      orders.addItems(
        first.id,
        [{ productId: pizza, quantity: 2 }],
        branchId,
        userId,
        addition,
      ),
    ]);
    expect(Number((await orders.findOne(first.id, branchId)).total)).toBe(400);
    expect(await db.orderItem.count({ where: { orderId: first.id } })).toBe(2);
  });

  it('13: cross-branch printing and child table linking are rejected', async () => {
    const order = await create();
    const other = (await db.branch.create({ data: { name: 'Other branch' } }))
      .id;
    await expect(
      print.queueTicket(order.id, other, 'KITCHEN'),
    ).rejects.toThrow();
    await expect(
      children.register(
        {
          branchId: other,
          tableId,
          childName: 'No',
          guardianName: 'No',
          contractedMinutes: 60,
        },
        userId,
      ),
    ).rejects.toThrow();
  });

  it('14: cancelled lines are excluded from inventory discount and customer receipt', async () => {
    await db.product.update({
      where: { id: breakfast },
      data: { trackInventory: true },
    });
    const stock = await db.inventoryItem.create({
      data: {
        branchId,
        productId: breakfast,
        name: 'Breakfast stock',
        currentStock: 10,
        minStock: 1,
        unit: 'piece',
      },
    });
    const order = await create([{ productId: breakfast, quantity: 2 }]);
    await orders.correctItem(
      order.id,
      order.items[0].id,
      { quantity: 1, reason: 'Captured twice' },
      branchId,
      userId,
      UserRoleEnum.WAITER,
    );
    await pay(order.id, 100);
    expect(
      Number(
        (await db.inventoryItem.findUniqueOrThrow({ where: { id: stock.id } }))
          .currentStock,
      ),
    ).toBe(9);
    const receipt = await print.getCustomerTicket(order.id, branchId);
    expect(receipt.items.map((i) => i.quantity)).toEqual([1]);
    expect(receipt.totals?.total).toBe(100);
  });

  it('15: legacy lines with unknown print history are never automatically dispatched', async () => {
    const order = await create();
    await db.orderItem.updateMany({
      where: { orderId: order.id },
      data: { preparationStatus: 'LEGACY' },
    });
    expect(await print.queueTicket(order.id, branchId, 'KITCHEN')).toBeNull();
    await orders.addItems(
      order.id,
      [{ productId: pizza, quantity: 2 }],
      branchId,
      userId,
    );
    expect(
      payload(await print.queueTicket(order.id, branchId, 'KITCHEN')).items.map(
        (i) => i.name,
      ),
    ).toEqual(['Pizza']);
  });

  it('16: correction waits for an in-flight batch, and a missing cancellation printer rolls back the correction', async () => {
    const order = await create();
    const job = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    const item = order.items.find((i) => i.productId === breakfast)!;
    const change = { quantity: 0, reason: 'Customer cancellation' };
    await expect(
      orders.correctItem(
        order.id,
        item.id,
        change,
        branchId,
        userId,
        UserRoleEnum.ADMIN,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await acknowledge(job.id);
    await db.setting.update({
      where: { branchId_key: { branchId, key: 'printer_kitchen' } },
      data: { value: '' },
    });
    await expect(
      orders.correctItem(
        order.id,
        item.id,
        change,
        branchId,
        userId,
        UserRoleEnum.ADMIN,
      ),
    ).rejects.toThrow();
    expect(
      (await db.orderItem.findUniqueOrThrow({ where: { id: item.id } })).status,
    ).not.toBe('CANCELLED');
    expect(Number((await orders.findOne(order.id, branchId)).total)).toBe(280);
    expect(
      await db.auditLog.count({
        where: { entityId: item.id, action: 'ORDER_ITEM_CORRECTED' },
      }),
    ).toBe(0);
  });

  it('17: database constraint prevents a second active order even outside the normal create service', async () => {
    await create();
    await expect(
      db.order.create({
        data: {
          branchId,
          tableId,
          userId,
          orderNumber: randomUUID(),
          subtotal: 0,
          total: 0,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('18: child checkin uses the existing table order and checkout is atomic between two devices', async () => {
    const order = await create();
    const child = await children.register(
      {
        branchId,
        tableId,
        requestId: randomUUID(),
        childName: 'Leo',
        guardianName: 'Tutor',
        contractedMinutes: 60,
      },
      userId,
    );
    expect(child.orderId).toBe(order.id);
    await db.childAccess.update({
      where: { id: child.id },
      data: { entryTime: new Date(Date.now() - 80 * 60000) },
    });
    const results = await Promise.allSettled([
      children.checkout(
        child.id,
        { accessCode: child.accessCode },
        branchId,
        userId,
      ),
      children.checkout(
        child.id,
        { accessCode: child.accessCode },
        branchId,
        userId,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(HttpException);
    expect(
      (failure.reason as HttpException).getStatus(),
    ).toBeGreaterThanOrEqual(400);
    expect((failure.reason as HttpException).getStatus()).toBeLessThan(500);
    const record = await db.childAccess.findUniqueOrThrow({
      where: { id: child.id },
    });
    expect(record.extraOrderItemId).not.toBeNull();
    expect(Number((await orders.findOne(order.id, branchId)).total)).toBe(428);
    const history = await children.findAll(branchId);
    expect(history[0]).toMatchObject({
      runtimeStatus: 'COMPLETED',
      elapsedMinutes: 80,
      calculatedExtraAmount: 49,
      calculatedTotalAmount: 148,
    });
  });

  it('19: sent-item authorization and cancellation preserve the original station after product routing changes', async () => {
    const order = await create([{ productId: breakfast, quantity: 2 }]);
    const job = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    await acknowledge(job.id);
    await db.product.update({
      where: { id: breakfast },
      data: { preparationStation: 'NONE', name: 'Renamed product' },
    });
    const correction = { quantity: 0, reason: 'Wrong item' };
    await expect(
      orders.correctItem(
        order.id,
        order.items[0].id,
        correction,
        branchId,
        userId,
        UserRoleEnum.WAITER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await orders.correctItem(
      order.id,
      order.items[0].id,
      correction,
      branchId,
      userId,
      UserRoleEnum.CASHIER,
    );
    const cancellation = (
      await db.printJob.findMany({ where: { orderId: order.id } })
    ).find((j) => payload(j).dispatch?.kind === 'CANCELLATION')!;
    expect(cancellation.type).toBe('KITCHEN');
    expect(
      payload(cancellation).items.map((i) => [i.name, i.quantity]),
    ).toEqual([['Desayuno', 2]]);
    expect(payload(cancellation).dispatch?.originalBatchId).toBe(job.id);
  });

  async function configureCashier(
    overrides: Partial<
      Awaited<ReturnType<PrintService['getPrintConfig']>>
    > = {},
  ) {
    return print.updatePrintConfig(branchId, {
      ...(await print.getPrintConfig(branchId)),
      cashierPrinter: 'windows:///Caja QA',
      kitchenPrinter: 'windows:///Cocina QA',
      barPrinter: 'tcp://192.0.2.30:9100',
      cashierMode: 'CUSTOMER_AND_BUSINESS',
      autoCustomer: true,
      ...overrides,
    });
  }

  it('20: three separate destinations, prebill does not close/pay, and updated prebill contains new items', async () => {
    await configureCashier();
    const order = await create();
    const kitchen = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    const bar = (await print.queueTicket(order.id, branchId, 'BAR'))!;
    expect(kitchen.printerTarget).toBe('windows:///Cocina QA');
    expect(bar.printerTarget).toBe('tcp://192.0.2.30:9100');
    const before = await orders.findOne(order.id, branchId);
    const key = randomUUID();
    const jobs = await Promise.all([
      print.queuePrebill(order.id, branchId, key),
      print.queuePrebill(order.id, branchId, key),
    ]);
    expect(jobs[0].id).toBe(jobs[1].id);
    expect(jobs[0].printerTarget).toBe('windows:///Caja QA');
    expect(payload(jobs[0]).cashierDocument?.kind).toBe('PREBILL');
    expect(payload(jobs[0]).totals?.total).toBe(280);
    expect(await orders.findOne(order.id, branchId)).toEqual(before);
    expect(
      (await db.restaurantTable.findUniqueOrThrow({ where: { id: tableId } }))
        .status,
    ).toBe('OCCUPIED');
    await orders.addItems(
      order.id,
      [{ productId: pizza, quantity: 2 }],
      branchId,
      userId,
    );
    const updated = await print.queuePrebill(order.id, branchId, randomUUID());
    expect(updated.id).not.toBe(jobs[0].id);
    expect(payload(updated).totals?.total).toBe(580);
    expect(payload(jobs[0]).totals?.total).toBe(280);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('21: split payment keeps table occupied and final business receipt includes actual cashier, cash received and change', async () => {
    await configureCashier();
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    await pay(order.id, 40, 'CARD');
    const prebill = await print.queuePrebill(order.id, branchId, randomUUID());
    expect(payload(prebill).totals).toMatchObject({ total: 100, paid: 40 });
    expect(
      await db.printJob.count({ where: { dedupKey: `business:${order.id}` } }),
    ).toBe(0);
    const cashier = await db.user.create({
      data: {
        branchId,
        email: randomUUID() + '@qa.invalid',
        firstName: 'Caja',
        lastName: 'Dos',
        role: 'CASHIER',
        passwordHash: 'not-login',
      },
    });
    const finalKey = randomUUID();
    const result = await payments.create(
      {
        orderId: order.id,
        method: 'CASH',
        amount: 60,
        receivedAmount: 100,
        idempotencyKey: finalKey,
      },
      cashier.id,
      branchId,
    );
    expect(result.summary).toMatchObject({
      paymentStatus: 'PAID',
      totalPaid: 100,
      changeAmount: 40,
    });
    const receipt = await print.getBusinessReceipt(order.id, branchId);
    expect(receipt.status).toBe('PENDING');
    expect(receipt.document.cashierDocument).toMatchObject({
      kind: 'BUSINESS',
      receiptId: receipt.id,
    });
    expect(receipt.document.order).toMatchObject({
      waiter: 'Ana Mesera',
      cashier: 'Caja Dos',
      table: '2',
      timezone: 'America/Mexico_City',
    });
    expect(receipt.document.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'CARD', amount: 40 }),
        expect.objectContaining({
          method: 'CASH',
          amount: 60,
          receivedAmount: 100,
          changeAmount: 40,
        }),
      ]),
    );
    await payments.create(
      {
        orderId: order.id,
        method: 'CASH',
        amount: 60,
        receivedAmount: 100,
        idempotencyKey: finalKey,
      },
      cashier.id,
      branchId,
    );
    expect(
      await db.printJob.count({ where: { dedupKey: `business:${order.id}` } }),
    ).toBe(1);
    expect(
      (await db.restaurantTable.findUniqueOrThrow({ where: { id: tableId } }))
        .status,
    ).toBe('AVAILABLE');
    expect((await create([{ productId: pizza, quantity: 1 }])).id).not.toBe(
      order.id,
    );
  });

  it('22: disconnected cashier printer cannot undo final payment and reprint preserves original snapshot without charging', async () => {
    await configureCashier();
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    await pay(order.id, 100);
    const original = await print.getBusinessReceipt(order.id, branchId);
    await db.printJob.update({
      where: { id: original.id },
      data: { status: 'PROCESSING', claimedBy: 'test-agent', attempts: 1 },
    });
    await print.failJob(original.id, 'test-agent', 'Caja desconectada');
    expect((await orders.findOne(order.id, branchId)).status).toBe('COMPLETED');
    expect(
      (await db.restaurantTable.findUniqueOrThrow({ where: { id: tableId } }))
        .status,
    ).toBe('AVAILABLE');
    await db.product.update({
      where: { id: breakfast },
      data: { name: 'Changed later', price: 999 },
    });
    const requestId = randomUUID();
    const copies = await Promise.all([
      print.printBusinessReceipt(
        order.id,
        branchId,
        userId,
        requestId,
        'Reconnected printer',
      ),
      print.printBusinessReceipt(
        order.id,
        branchId,
        userId,
        requestId,
        'Reconnected printer',
      ),
    ]);
    expect(copies[0].id).toBe(copies[1].id);
    expect(payload(copies[0]).items).toEqual(original.document.items);
    expect(payload(copies[0]).cashierDocument).toMatchObject({
      kind: 'BUSINESS',
      receiptId: original.id,
      issuedAt: original.document.cashierDocument!.issuedAt,
      reprint: true,
    });
    await acknowledge(copies[0].id);
    expect(
      (
        await print.printBusinessReceipt(
          order.id,
          branchId,
          userId,
          requestId,
          'Retry response',
        )
      ).id,
    ).toBe(copies[0].id);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await db.auditLog.count({
        where: { entityId: original.id, action: 'BUSINESS_RECEIPT_REPRINT' },
      }),
    ).toBe(1);
  });

  it('23: Solo negocio rejects prebill, automatic receipt can be held, and first manual print is not a reprint', async () => {
    await configureCashier({
      cashierMode: 'BUSINESS_ONLY',
      autoCustomer: false,
      allowReprint: false,
    });
    expect(await print.getCashierPolicy(branchId)).toMatchObject({
      cashierMode: 'BUSINESS_ONLY',
      autoCustomer: false,
      allowReprint: false,
    });
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    await expect(print.getPrebill(order.id, branchId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      print.queuePrebill(order.id, branchId, randomUUID()),
    ).rejects.toBeInstanceOf(ConflictException);
    await pay(order.id, 100);
    const receipt = await print.getBusinessReceipt(order.id, branchId);
    expect(receipt.status).toBe('HELD');
    const first = await print.printBusinessReceipt(
      order.id,
      branchId,
      userId,
      randomUUID(),
      'First manual print',
    );
    expect(payload(first).cashierDocument?.reprint).toBe(false);
    expect(
      (
        await print.printBusinessReceipt(
          order.id,
          branchId,
          userId,
          randomUUID(),
          'Double click',
        )
      ).id,
    ).toBe(first.id);
    await acknowledge(first.id);
    await expect(
      print.printBusinessReceipt(
        order.id,
        branchId,
        userId,
        randomUUID(),
        'Attempt reprint',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('24: missing cashier target holds the immutable receipt while payment and table close still succeed', async () => {
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    const result = await pay(order.id, 100);
    expect(result.summary.paymentStatus).toBe('PAID');
    expect(result.receipt?.status).toBe('HELD');
    const saved = await print.getBusinessReceipt(order.id, branchId);
    expect(saved.lastError).toContain('impresora de caja');
    await configureCashier();
    const recovered = await print.printBusinessReceipt(
      order.id,
      branchId,
      userId,
      randomUUID(),
      'Configured printer',
    );
    expect(recovered.printerTarget).toBe('windows:///Caja QA');
    expect(payload(recovered).cashierDocument?.receiptId).toBe(saved.id);
    expect(
      (await db.restaurantTable.findUniqueOrThrow({ where: { id: tableId } }))
        .status,
    ).toBe('AVAILABLE');
  });

  it('25: configured final-close confirmation is enforced by backend, without writing payment on rejection', async () => {
    await configureCashier({ confirmClose: true });
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    await expect(pay(order.id, 100)).rejects.toBeInstanceOf(ConflictException);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(0);
    expect(
      await db.printJob.count({ where: { dedupKey: `business:${order.id}` } }),
    ).toBe(0);
    const result = await payments.create(
      { orderId: order.id, amount: 100, method: 'CARD', closeConfirmed: true },
      userId,
      branchId,
    );
    expect(result.summary.paymentStatus).toBe('PAID');
  });

  it('26: cashier document APIs do not expose other branches or bypass customer flow through generic queue', async () => {
    await configureCashier();
    const order = await create([{ productId: breakfast, quantity: 1 }]);
    const other = (
      await db.branch.create({ data: { name: 'Other cashier branch' } })
    ).id;
    await expect(print.getPrebill(order.id, other)).rejects.toThrow();
    await expect(
      print.queueTicket(order.id, branchId, 'CUSTOMER'),
    ).rejects.toThrow();
    await pay(order.id, 100);
    await expect(print.getBusinessReceipt(order.id, other)).rejects.toThrow();
    await expect(
      print.printBusinessReceipt(
        order.id,
        other,
        userId,
        randomUUID(),
        'Not authorized branch',
      ),
    ).rejects.toThrow();
  });

  it('27: same product with different preparation comments remains separate through persistence and kitchen printing', async () => {
    const order = await create([
      {
        productId: breakfast,
        quantity: 1,
        notes: 'Huevos bien cocidos\nSin cebolla',
      },
      { productId: breakfast, quantity: 1, notes: 'Huevos tiernitos' },
    ]);
    expect(order.items).toHaveLength(2);
    expect(order.items.map((i) => [i.quantity, i.notes])).toEqual(
      expect.arrayContaining([
        [1, 'Huevos bien cocidos\nSin cebolla'],
        [1, 'Huevos tiernitos'],
      ]),
    );
    const job = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    expect(payload(job).items.map((i) => [i.quantity, i.notes])).toEqual(
      expect.arrayContaining([
        [1, 'Huevos bien cocidos\nSin cebolla'],
        [1, 'Huevos tiernitos'],
      ]),
    );
    await orders.addItems(
      order.id,
      [{ productId: pizza, quantity: 1, notes: 'Sin aceitunas' }],
      branchId,
      userId,
    );
    const second = (await print.queueTicket(order.id, branchId, 'KITCHEN'))!;
    expect(payload(second).items.map((i) => i.notes)).toEqual([
      'Sin aceitunas',
    ]);
    expect(
      (await orders.findOne(order.id, branchId)).items.map((i) => i.notes),
    ).toEqual(
      expect.arrayContaining([
        'Huevos bien cocidos\nSin cebolla',
        'Huevos tiernitos',
      ]),
    );
  });
});
