import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethod, PrismaClient, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { io, Socket } from 'socket.io-client';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';

const smokeDatabaseUrl =
  process.env.SMOKE_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const describeSmoke = smokeDatabaseUrl ? describe : describe.skip;

type AuthSession = {
  token: string;
  refreshToken: string;
  user: Record<string, unknown>;
};
type SmokeOrderItem = {
  id: string;
  productId: string;
  quantity: number;
  totalPrice: number | string;
};
type SmokeOrder = {
  id: string;
  total: number | string;
  status: string;
  items: SmokeOrderItem[];
};
type SmokePaymentResponse = {
  summary: { paymentStatus: string; total: number; totalPaid: number };
};

function responseData<T>(response: { body: { data: T } }) {
  return response.body.data;
}

describeSmoke('PlayCoffee staging smoke e2e', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  const password = 'SmokePass123!';
  const prefix = `smoke-${Date.now()}`;
  const branchAId = `${prefix}-branch-a`;
  const branchBId = `${prefix}-branch-b`;
  const productAId = `${prefix}-product-a`;
  const productBId = `${prefix}-product-b`;
  const inventoryProductId = `${prefix}-product-inventory`;
  const inventoryItemId = `${prefix}-inventory-item`;
  const inactiveProductId = `${prefix}-product-inactive`;
  const deletedProductId = `${prefix}-product-deleted`;
  const tableAId = `${prefix}-table-a`;
  const tableBId = `${prefix}-table-b`;
  const areaAId = `${prefix}-area-a`;
  const areaBId = `${prefix}-area-b`;
  const superAdminId = `${prefix}-super-admin`;
  const adminAId = `${prefix}-admin-a`;
  const adminBId = `${prefix}-admin-b`;
  const cashierAId = `${prefix}-cashier-a`;
  const waiterAId = `${prefix}-waiter-a`;
  let superAdmin: AuthSession;
  let adminA: AuthSession;
  let adminB: AuthSession;
  let cashierA: AuthSession;
  let waiterA: AuthSession;

  beforeAll(async () => {
    process.env.DATABASE_URL = smokeDatabaseUrl;
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL ??= 'redis://localhost:6379';
    process.env.JWT_SECRET ??= 'smoke_jwt_secret_12345678901234567890';
    process.env.JWT_REFRESH_SECRET ??= 'smoke_refresh_secret_123456789012345';
    process.env.JWT_EXPIRES_IN ??= '1h';
    process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
    process.env.CORS_ORIGIN ??= 'http://localhost:3000';
    process.env.PORT ??= '3001';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await seedSmokeData(prisma);

    superAdmin = await login(`${prefix}-super.smoke@example.com`);
    adminA = await login(`${prefix}-admin-a.smoke@example.com`);
    adminB = await login(`${prefix}-admin-b.smoke@example.com`);
    cashierA = await login(`${prefix}-cashier-a.smoke@example.com`);
    waiterA = await login(`${prefix}-waiter-a.smoke@example.com`);
    await request(server)
      .post('/api/v1/cash/open')
      .set('Authorization', auth(cashierA))
      .send({ openingBalance: 0 })
      .expect(201);
  });

  afterEach(async () => {
    // Isolate table occupancy between scenarios; these are disposable smoke fixtures.
    if (!prisma) return;
    await prisma.order.updateMany({
      where: {
        tableId: { in: [tableAId, tableBId] },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: { status: 'CANCELLED' },
    });
    await prisma.restaurantTable.updateMany({
      where: { id: { in: [tableAId, tableBId] } },
      data: { status: 'AVAILABLE' },
    });
  });

  afterAll(async () => {
    if (!prisma) {
      if (app) await app.close();
      return;
    }
    await cleanupSmokeData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('saves new tables in an empty area, edits and deletes them atomically with branch and role checks', async () => {
    const area = await prisma.tableArea.create({
      data: { branchId: branchAId, name: `${prefix}-empty-layout` },
    });
    const save = (
      session: AuthSession,
      tables: unknown[],
      deletedIds: string[] = [],
    ) =>
      request(server)
        .post('/api/v1/tables/layout')
        .set('Authorization', auth(session))
        .send({ areaId: area.id, tables, deletedIds });
    const first = {
      areaId: area.id,
      number: '1',
      capacity: 4,
      posX: 100,
      posY: 100,
      width: 120,
      height: 120,
      shape: 'rect',
    };
    await save(waiterA, [first]).expect(403);
    await save(adminB, [first]).expect(400);
    const created = responseData<Array<{ id: string }>>(
      await save(cashierA, [first]).expect(201),
    )[0];
    const edited = { ...first, id: created.id, number: 'VIP', posX: 200 };
    await save(adminA, [edited, { ...first, number: '2' }]).expect(201);
    const saved = await prisma.restaurantTable.findMany({
      where: { areaId: area.id, deletedAt: null },
    });
    expect(saved).toHaveLength(2);
    expect(saved.find((table) => table.id === created.id)?.posX).toBe(200);
    // Invalid rows roll back the whole layout, including preceding edits.
    await save(cashierA, [
      { ...edited, posX: 300 },
      { ...first, areaId: areaBId },
    ]).expect(400);
    expect(
      (
        await prisma.restaurantTable.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).posX,
    ).toBe(200);
    await save(adminA, [{ ...edited, number: '2' }]).expect(400);
    const other = saved.find((table) => table.id !== created.id)!;
    await prisma.restaurantTable.update({
      where: { id: created.id },
      data: { status: 'OCCUPIED' },
    });
    await save(adminA, [edited], [other.id]).expect(201);
    expect(
      (
        await prisma.restaurantTable.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).status,
    ).toBe('OCCUPIED');
    await save(adminA, [], [created.id]).expect(400);
    await request(server)
      .delete(`/api/v1/tables/${created.id}`)
      .set('Authorization', auth(cashierA))
      .expect(400);
    await prisma.restaurantTable.update({
      where: { id: created.id },
      data: { status: 'AVAILABLE' },
    });
    await save(adminA, [], [created.id]).expect(201);
    expect(
      await prisma.restaurantTable.count({
        where: { areaId: area.id, deletedAt: null },
      }),
    ).toBe(0);
    await save(adminA, [{ ...first, capacity: 1.5 }]).expect(400);
  });

  it('creates active and inactive products using the exact catalog fields', async () => {
    for (const isActive of [true, false]) {
      const response = await request(server)
        .post('/api/v1/products')
        .set('Authorization', auth(adminA))
        .send({
          name: `${prefix}-catalog-${isActive}`,
          price: 35,
          taxRate: 16,
          preparationStation: 'BAR',
          trackInventory: false,
          isFeatured: false,
          isActive,
        })
        .expect(201);
      expect(response.body.data.isActive).toBe(isActive);
      await prisma.product.delete({ where: { id: response.body.data.id } });
    }
  });

  it('queues printer tests without sales and restricts access to the administrator branch', async () => {
    const ordersBefore = await prisma.order.count({
      where: { branchId: branchAId },
    });
    const response = await request(server)
      .post('/api/v1/print/test')
      .set('Authorization', auth(adminA))
      .send({
        target: 'windows:///Caja%20Prueba',
        width: '58mm',
        type: 'CUSTOMER',
      })
      .expect(201);
    const jobId = response.body.data.id as string;
    const job = await prisma.printJob.findUniqueOrThrow({
      where: { id: jobId },
    });
    expect(job.orderId).toBeNull();
    expect(job.maxAttempts).toBe(1);
    expect(job.printerTarget).toBe('windows:///Caja%20Prueba');
    expect(await prisma.order.count({ where: { branchId: branchAId } })).toBe(
      ordersBefore,
    );
    await request(server)
      .get(`/api/v1/print/jobs/${jobId}`)
      .set('Authorization', auth(adminB))
      .expect(404);
    await request(server)
      .post('/api/v1/print/test')
      .set('Authorization', auth(cashierA))
      .send({ target: 'windows:///Caja', width: '80mm', type: 'BAR' })
      .expect(403);
    await request(server)
      .post('/api/v1/print/test')
      .set('Authorization', auth(adminA))
      .send({ target: 'windows:///', width: '80mm', type: 'BAR' })
      .expect(400);
    await request(server)
      .post('/api/v1/print/test')
      .set('Authorization', auth(adminA))
      .send({ target: 'http://example.test', width: '80mm', type: 'BAR' })
      .expect(400);
    await prisma.printJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', lastError: 'Sin papel' },
    });
    const failed = await request(server)
      .get(`/api/v1/print/jobs/${jobId}`)
      .set('Authorization', auth(adminA))
      .expect(200);
    expect(failed.body.data).toMatchObject({
      status: 'FAILED',
      lastError: 'Sin papel',
    });
  });

  it('reminds cashier and admins about an old open shift, scoped to their branch', async () => {
    const shift = await prisma.shift.findFirstOrThrow({
      where: { branchId: branchAId, closedAt: null },
    });
    try {
      await prisma.shift.update({
        where: { id: shift.id },
        data: { openedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      });
      for (const session of [cashierA, adminA, superAdmin]) {
        const response = await request(server)
          .get('/api/v1/cash/closing-reminder')
          .set('Authorization', auth(session))
          .expect(200);
        expect(response.body.data).toMatchObject({
          shiftId: shift.id,
          fromPreviousDay: true,
          timezone: 'America/Mexico_City',
        });
      }
      const otherBranch = await request(server)
        .get('/api/v1/cash/closing-reminder')
        .set('Authorization', auth(adminB))
        .expect(200);
      expect(otherBranch.body.data).toBeNull();
      await request(server)
        .get('/api/v1/cash/closing-reminder')
        .set('Authorization', auth(waiterA))
        .expect(403);
      await prisma.shift.update({
        where: { id: shift.id },
        data: { closedAt: new Date() },
      });
      const closed = await request(server)
        .get('/api/v1/cash/closing-reminder')
        .set('Authorization', auth(cashierA))
        .expect(200);
      expect(closed.body.data).toBeNull();
    } finally {
      await prisma.shift.update({
        where: { id: shift.id },
        data: { openedAt: shift.openedAt, closedAt: null },
      });
    }
  });

  async function seedSmokeData(db: PrismaClient) {
    const passwordHash = await bcrypt.hash(password, 10);
    await db.branch.createMany({
      data: [
        { id: branchAId, name: `${prefix} Branch A` },
        { id: branchBId, name: `${prefix} Branch B` },
      ],
    });
    await db.tableArea.createMany({
      data: [
        {
          id: areaAId,
          branchId: branchAId,
          name: `${prefix} Area A`,
          order: 1,
        },
        {
          id: areaBId,
          branchId: branchBId,
          name: `${prefix} Area B`,
          order: 1,
        },
      ],
    });
    await db.restaurantTable.createMany({
      data: [
        { id: tableAId, areaId: areaAId, number: 'A1', capacity: 4 },
        { id: tableBId, areaId: areaBId, number: 'B1', capacity: 4 },
      ],
    });
    await db.user.createMany({
      data: [
        {
          id: superAdminId,
          branchId: branchAId,
          email: `${prefix}-super.smoke@example.com`,
          firstName: 'Super',
          lastName: 'Smoke',
          passwordHash,
          role: UserRoleEnum.SUPER_ADMIN,
        },
        {
          id: adminAId,
          branchId: branchAId,
          email: `${prefix}-admin-a.smoke@example.com`,
          firstName: 'Admin',
          lastName: 'A',
          passwordHash,
          role: UserRoleEnum.ADMIN,
        },
        {
          id: adminBId,
          branchId: branchBId,
          email: `${prefix}-admin-b.smoke@example.com`,
          firstName: 'Admin',
          lastName: 'B',
          passwordHash,
          role: UserRoleEnum.ADMIN,
        },
        {
          id: cashierAId,
          branchId: branchAId,
          email: `${prefix}-cashier-a.smoke@example.com`,
          firstName: 'Cashier',
          lastName: 'A',
          passwordHash,
          role: UserRoleEnum.CASHIER,
        },
        {
          id: waiterAId,
          branchId: branchAId,
          email: `${prefix}-waiter-a.smoke@example.com`,
          firstName: 'Waiter',
          lastName: 'A',
          passwordHash,
          role: UserRoleEnum.WAITER,
        },
      ],
    });
    await db.product.createMany({
      data: [
        { id: productAId, name: `${prefix} Latte`, price: 65, isActive: true },
        { id: productBId, name: `${prefix} Muffin`, price: 40, isActive: true },
        {
          id: inventoryProductId,
          name: `${prefix} Bottled drink`,
          price: 30,
          isActive: true,
          trackInventory: true,
        },
        {
          id: inactiveProductId,
          name: `${prefix} Inactive`,
          price: 10,
          isActive: false,
        },
        {
          id: deletedProductId,
          name: `${prefix} Deleted`,
          price: 10,
          isActive: true,
          deletedAt: new Date(),
        },
      ],
    });
    await db.inventoryItem.create({
      data: {
        id: inventoryItemId,
        branchId: branchAId,
        productId: inventoryProductId,
        name: `${prefix} Bottled drink stock`,
        currentStock: 10,
        minStock: 2,
        unit: 'pieza',
      },
    });
  }

  async function cleanupSmokeData(db: PrismaClient) {
    await db.printJob.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.cashMovement.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.childAccess.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.setting.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.inventoryMovement.deleteMany({
      where: { inventoryItemId },
    });
    await db.payment.deleteMany({
      where: { order: { branchId: { in: [branchAId, branchBId] } } },
    });
    await db.order.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.shift.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.inventoryItem.deleteMany({ where: { id: inventoryItemId } });
    await db.restaurantTable.deleteMany({
      where: { area: { branchId: { in: [branchAId, branchBId] } } },
    });
    await db.tableArea.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.user.deleteMany({
      where: {
        email: {
          in: [
            `${prefix}-super.smoke@example.com`,
            `${prefix}-admin-a.smoke@example.com`,
            `${prefix}-admin-b.smoke@example.com`,
            `${prefix}-cashier-a.smoke@example.com`,
            `${prefix}-waiter-a.smoke@example.com`,
          ],
        },
      },
    });
    await db.product.deleteMany({
      where: {
        id: {
          in: [
            productAId,
            productBId,
            inventoryProductId,
            inactiveProductId,
            deletedProductId,
          ],
        },
      },
    });
    await db.branch.deleteMany({
      where: { id: { in: [branchAId, branchBId] } },
    });
  }

  async function login(email: string): Promise<AuthSession> {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const data = responseData<{
      accessToken: string;
      refreshToken: string;
      user: Record<string, unknown>;
    }>(response);
    return {
      token: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };
  }

  function auth(session: AuthSession) {
    return `Bearer ${session.token}`;
  }

  async function createOrder(
    session: AuthSession,
    data: { branchId?: string; tableId?: string; items?: unknown[] } = {},
  ): Promise<SmokeOrder> {
    const response = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', auth(session))
      .send({
        branchId: data.branchId ?? branchAId,
        tableId: data.tableId,
        items: data.items ?? [],
      })
      .expect(201);
    return responseData<SmokeOrder>(response);
  }

  async function addItems(
    session: AuthSession,
    orderId: string,
    items: unknown[],
    expectedStatus = 201,
  ): Promise<SmokeOrder> {
    const response = await request(server)
      .post(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', auth(session))
      .send({ items })
      .expect(expectedStatus);
    return responseData<SmokeOrder>(response);
  }

  async function pay(
    session: AuthSession,
    orderId: string,
    amount: number,
    expectedStatus = 201,
  ): Promise<request.Response> {
    return request(server)
      .post('/api/v1/payments')
      .set('Authorization', auth(session))
      .send({ orderId, method: PaymentMethod.CARD, amount })
      .expect(expectedStatus);
  }

  describe('auth and RBAC', () => {
    it('logs in ADMIN and CASHIER and sanitizes auth response', () => {
      expect(adminA.token).toBeTruthy();
      expect(cashierA.token).toBeTruthy();
      expect(adminA.user).not.toHaveProperty('passwordHash');
      expect(adminA.user).not.toHaveProperty('pin');
      expect(adminA.user).not.toHaveProperty('refreshToken');
    });

    it('returns 401 without token', () =>
      request(server).get('/api/v1/users').expect(401));

    it('returns 403 for CASHIER reports and allows ADMIN reports', async () => {
      await request(server)
        .get('/api/v1/reports/kpis')
        .set('Authorization', auth(cashierA))
        .expect(403);
      await request(server)
        .get('/api/v1/reports/kpis')
        .set('Authorization', auth(adminA))
        .expect(200);
    });

    it('keeps device sessions independent when one device logs out', async () => {
      const deviceA = await login(`${prefix}-cashier-a.smoke@example.com`);
      const deviceB = await login(`${prefix}-cashier-a.smoke@example.com`);

      const refreshedA = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: deviceA.refreshToken })
        .expect(200);
      const refreshedB = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: deviceB.refreshToken })
        .expect(200);
      const rotatedA = responseData<{ refreshToken: string }>(refreshedA);
      const rotatedB = responseData<{ refreshToken: string }>(refreshedB);

      await request(server)
        .post('/api/v1/auth/logout')
        .set('Authorization', auth(deviceA))
        .expect(204);

      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedA.refreshToken })
        .expect(401);
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedB.refreshToken })
        .expect(200);
    });
  });

  describe('user security', () => {
    it('allows ADMIN to create CASHIER and WAITER only in own branch', async () => {
      const cashier = await request(server)
        .post('/api/v1/users')
        .set('Authorization', auth(adminA))
        .send({
          email: `${prefix}.new-cashier@example.com`,
          firstName: 'New',
          lastName: 'Cashier',
          password,
          role: UserRoleEnum.CASHIER,
        })
        .expect(201);
      expect(cashier.body.data.branchId).toBe(branchAId);
      expect(cashier.body.data).not.toHaveProperty('passwordHash');

      await request(server)
        .post('/api/v1/users')
        .set('Authorization', auth(adminA))
        .send({
          email: `${prefix}.new-waiter@example.com`,
          firstName: 'New',
          lastName: 'Waiter',
          password,
          role: UserRoleEnum.WAITER,
        })
        .expect(201);
    });

    it('blocks ADMIN from creating or assigning elevated roles', async () => {
      await request(server)
        .post('/api/v1/users')
        .set('Authorization', auth(adminA))
        .send({
          email: `${prefix}.new-admin@example.com`,
          firstName: 'New',
          lastName: 'Admin',
          password,
          role: UserRoleEnum.ADMIN,
        })
        .expect(403);

      await request(server)
        .post('/api/v1/users')
        .set('Authorization', auth(adminA))
        .send({
          email: `${prefix}.new-super@example.com`,
          firstName: 'New',
          lastName: 'Super',
          password,
          role: UserRoleEnum.SUPER_ADMIN,
        })
        .expect(403);

      await request(server)
        .patch(`/api/v1/users/${cashierAId}`)
        .set('Authorization', auth(adminA))
        .send({ role: UserRoleEnum.SUPER_ADMIN })
        .expect(403);
    });

    it('blocks ADMIN from mutating SUPER_ADMIN or other branches', async () => {
      await request(server)
        .patch(`/api/v1/users/${superAdminId}`)
        .set('Authorization', auth(adminA))
        .send({ firstName: 'Blocked' })
        .expect(403);
      await request(server)
        .patch(`/api/v1/users/${superAdminId}`)
        .set('Authorization', auth(adminA))
        .send({ isActive: false })
        .expect(403);
      await request(server)
        .patch(`/api/v1/users/${adminBId}`)
        .set('Authorization', auth(adminA))
        .send({ firstName: 'Blocked' })
        .expect(403);
    });

    it('allows SUPER_ADMIN to administer ADMIN, CASHIER and WAITER', async () => {
      await request(server)
        .patch(`/api/v1/users/${adminAId}`)
        .set('Authorization', auth(superAdmin))
        .send({ firstName: 'AdminSmoke' })
        .expect(200);
      await request(server)
        .patch(`/api/v1/users/${cashierAId}`)
        .set('Authorization', auth(superAdmin))
        .send({ firstName: 'CashierSmoke' })
        .expect(200);
      await request(server)
        .patch(`/api/v1/users/${waiterAId}`)
        .set('Authorization', auth(superAdmin))
        .send({ firstName: 'WaiterSmoke' })
        .expect(200);
    });
  });

  describe('orders, tables and add items', () => {
    it('creates empty order and adds first item to total-zero order', async () => {
      const order = await createOrder(waiterA, { tableId: tableAId });
      expect(Number(order.total)).toBe(0);
      const updated = await addItems(waiterA, order.id, [
        { productId: productAId, quantity: 1 },
      ]);
      expect(Number(updated.total)).toBe(65);
      expect(updated.items).toHaveLength(1);
    });

    it('adds multiple items and consolidates duplicates in one payload', async () => {
      const order = await createOrder(waiterA);
      const updated = await addItems(waiterA, order.id, [
        { productId: productAId, quantity: 1 },
        { productId: productAId, quantity: 2 },
        { productId: productBId, quantity: 1 },
      ]);
      const latte = updated.items.find((item) => item.productId === productAId);
      if (!latte) throw new Error('Expected consolidated product item');
      expect(latte.quantity).toBe(3);
      expect(updated.items).toHaveLength(2);
      expect(Number(updated.total)).toBe(235);
    });

    it('rejects invalid add-item scenarios', async () => {
      const order = await createOrder(waiterA);
      await addItems(waiterA, order.id, [], 400);
      await addItems(
        waiterA,
        order.id,
        [{ productId: 'missing', quantity: 1 }],
        404,
      );
      await addItems(
        waiterA,
        order.id,
        [{ productId: inactiveProductId, quantity: 1 }],
        400,
      );
      await addItems(
        waiterA,
        order.id,
        [{ productId: deletedProductId, quantity: 1 }],
        404,
      );
      await addItems(
        waiterA,
        order.id,
        [{ productId: productAId, quantity: 0 }],
        400,
      );
      await addItems(
        waiterA,
        order.id,
        [{ productId: productAId, quantity: -1 }],
        400,
      );
    });

    it('rejects add items in CANCELLED, COMPLETED and fully paid orders', async () => {
      const cancelled = await createOrder(waiterA);
      await request(server)
        .delete(`/api/v1/orders/${cancelled.id}`)
        .set('Authorization', auth(waiterA))
        .expect(204);
      await addItems(
        waiterA,
        cancelled.id,
        [{ productId: productAId, quantity: 1 }],
        400,
      );

      const completed = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      await pay(cashierA, completed.id, 65);
      await addItems(
        waiterA,
        completed.id,
        [{ productId: productBId, quantity: 1 }],
        400,
      );
    });

    it.skip('rejects product from another branch', () => {
      // Product is currently global in Prisma and has no branchId to scope here.
    });
  });

  describe('order states and payments', () => {
    it('blocks manual COMPLETED while delivered order has no or partial payment', async () => {
      const order = await createOrder(waiterA, {
        tableId: tableAId,
        items: [{ productId: productAId, quantity: 1 }],
      });
      await request(server)
        .patch(`/api/v1/orders/${order.id}`)
        .set('Authorization', auth(waiterA))
        .send({ status: 'DELIVERED' })
        .expect(200);
      await request(server)
        .patch(`/api/v1/orders/${order.id}`)
        .set('Authorization', auth(waiterA))
        .send({ status: 'COMPLETED' })
        .expect(409);
      await pay(cashierA, order.id, 20);
      await request(server)
        .patch(`/api/v1/orders/${order.id}`)
        .set('Authorization', auth(waiterA))
        .send({ status: 'COMPLETED' })
        .expect(409);
      const table = await prisma.restaurantTable.findUnique({
        where: { id: tableAId },
      });
      expect(table?.status).toBe('OCCUPIED');
    });

    it('keeps partial payment open and total payment completes and frees table', async () => {
      const order = await createOrder(waiterA, {
        tableId: tableAId,
        items: [{ productId: productAId, quantity: 1 }],
      });
      const partial = await pay(cashierA, order.id, 25);
      expect(
        responseData<SmokePaymentResponse>(partial).summary.paymentStatus,
      ).toBe('PARTIALLY_PAID');

      const full = await pay(cashierA, order.id, 40);
      expect(
        responseData<SmokePaymentResponse>(full).summary.paymentStatus,
      ).toBe('PAID');
      const completed = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(completed?.status).toBe('COMPLETED');
      const table = await prisma.restaurantTable.findUnique({
        where: { id: tableAId },
      });
      expect(table?.status).toBe('AVAILABLE');
    });

    it('applies percentage tip to the order total', async () => {
      const order = await createOrder(waiterA, {
        items: [{ productId: productBId, quantity: 1 }],
      });
      const response = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', auth(cashierA))
        .send({
          orderId: order.id,
          method: PaymentMethod.CARD,
          amount: 44,
          tipPercentage: 10,
          idempotencyKey: randomUUID(),
        })
        .expect(201);
      const result = responseData<SmokePaymentResponse>(response);
      expect(result.summary.total).toBe(44);
      expect(result.summary.paymentStatus).toBe('PAID');
      const updated = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(Number(updated?.tipAmount)).toBe(4);
      expect(Number(updated?.total)).toBe(44);
    });

    it('returns the same payment for a repeated idempotency key', async () => {
      const order = await createOrder(waiterA, {
        items: [{ productId: productBId, quantity: 1 }],
      });
      const idempotencyKey = randomUUID();
      const payload = {
        orderId: order.id,
        method: PaymentMethod.CARD,
        amount: 20,
        idempotencyKey,
      };
      const first = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', auth(cashierA))
        .send(payload)
        .expect(201);
      const second = await request(server)
        .post('/api/v1/payments')
        .set('Authorization', auth(cashierA))
        .send(payload)
        .expect(201);
      expect(responseData<{ payment: { id: string } }>(second).payment.id).toBe(
        responseData<{ payment: { id: string } }>(first).payment.id,
      );
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(
        1,
      );
    });

    it('discounts linked inventory exactly once when payment completes', async () => {
      const order = await createOrder(waiterA, {
        items: [{ productId: inventoryProductId, quantity: 2 }],
      });
      await pay(cashierA, order.id, 20);
      expect(
        Number(
          (
            await prisma.inventoryItem.findUnique({
              where: { id: inventoryItemId },
            })
          )?.currentStock,
        ),
      ).toBe(10);
      await pay(cashierA, order.id, 40);
      expect(
        Number(
          (
            await prisma.inventoryItem.findUnique({
              where: { id: inventoryItemId },
            })
          )?.currentStock,
        ),
      ).toBe(8);
      expect(
        await prisma.inventoryMovement.count({
          where: { inventoryItemId, reference: order.id },
        }),
      ).toBe(1);
    });

    it('rejects extra, overpaid and cancelled payments', async () => {
      const paid = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      await pay(cashierA, paid.id, 65);
      await pay(cashierA, paid.id, 1, 400);

      const overpay = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      await pay(cashierA, overpay.id, 70, 400);

      const cancelled = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      await request(server)
        .delete(`/api/v1/orders/${cancelled.id}`)
        .set('Authorization', auth(waiterA))
        .expect(204);
      await pay(cashierA, cancelled.id, 65, 400);
    });

    it('does not overpay on concurrent payment attempts', async () => {
      const order = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      const [first, second] = await Promise.allSettled([
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', auth(cashierA))
          .send({ orderId: order.id, method: PaymentMethod.CARD, amount: 65 }),
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', auth(cashierA))
          .send({ orderId: order.id, method: PaymentMethod.CARD, amount: 65 }),
      ]);
      const statuses = [first, second].map((result) =>
        result.status === 'fulfilled' ? result.value.status : 500,
      );
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      const payments = await prisma.payment.findMany({
        where: { orderId: order.id },
      });
      const paid = payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      expect(paid).toBe(65);
    });

    it('blocks state changes after CANCELLED or COMPLETED and frees table on cancel', async () => {
      const cancelled = await createOrder(waiterA, {
        tableId: tableAId,
        items: [{ productId: productAId, quantity: 1 }],
      });
      await request(server)
        .delete(`/api/v1/orders/${cancelled.id}`)
        .set('Authorization', auth(waiterA))
        .expect(204);
      const table = await prisma.restaurantTable.findUnique({
        where: { id: tableAId },
      });
      expect(table?.status).toBe('AVAILABLE');
      await request(server)
        .patch(`/api/v1/orders/${cancelled.id}`)
        .set('Authorization', auth(waiterA))
        .send({ status: 'READY' })
        .expect(409);

      const completed = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      await pay(cashierA, completed.id, 65);
      await request(server)
        .patch(`/api/v1/orders/${completed.id}`)
        .set('Authorization', auth(waiterA))
        .send({ status: 'READY' })
        .expect(409);
    });
  });

  describe('delivery regressions', () => {
    it('requires an open cash shift for every payment method and rejects payments after closing', async () => {
      const order = await createOrder(adminB, {
        branchId: branchBId,
        items: [{ productId: productBId, quantity: 1 }],
      });
      for (const method of ['CASH', 'CARD', 'TRANSFER']) {
        const response = await request(server)
          .post('/api/v1/payments')
          .set('Authorization', auth(adminB))
          .send({ orderId: order.id, method, amount: 1 })
          .expect(400);
        expect(JSON.stringify(response.body)).toContain('abrir caja');
      }
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(
        0,
      );
      await request(server)
        .post('/api/v1/cash/open')
        .set('Authorization', auth(adminB))
        .send({ openingBalance: 0 })
        .expect(201);
      await pay(adminB, order.id, 1);
      await request(server)
        .patch('/api/v1/cash/close')
        .set('Authorization', auth(adminB))
        .send({ closingBalance: 0 })
        .expect(200);
      await pay(adminB, order.id, 1, 400);
    });

    it('closes paid kitchen orders and frees the table without reusing their history', async () => {
      await prisma.product.update({
        where: { id: productAId },
        data: { preparationStation: 'KITCHEN' },
      });
      try {
        const order = await createOrder(waiterA, {
          tableId: tableAId,
          items: [{ productId: productAId, quantity: 1 }],
        });
        await pay(cashierA, order.id, Number(order.total));
        expect(
          (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
            .status,
        ).toBe('COMPLETED');
        expect(
          (
            await prisma.restaurantTable.findUniqueOrThrow({
              where: { id: tableAId },
            })
          ).status,
        ).toBe('AVAILABLE');
        await request(server)
          .delete(`/api/v1/orders/${order.id}`)
          .set('Authorization', auth(waiterA))
          .expect(409);
        const next = await createOrder(waiterA, {
          tableId: tableAId,
          items: [{ productId: productBId, quantity: 1 }],
        });
        expect(next.id).not.toBe(order.id);
        expect(next.items.map((item) => item.productId)).toEqual([productBId]);
      } finally {
        await prisma.product.update({
          where: { id: productAId },
          data: { preparationStation: 'NONE' },
        });
      }
    });

    it('delivers events to two authenticated devices and isolates other branches', async () => {
      const sockets: Socket[] = [];
      const connect = async (session: AuthSession) => {
        const socket = io(`${await app.getUrl()}/realtime`, {
          auth: { token: session.token },
          transports: ['websocket'],
          autoConnect: false,
        });
        sockets.push(socket);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Socket authentication timeout')),
            5000,
          );
          socket.once('realtime.connected', () => {
            clearTimeout(timer);
            resolve();
          });
          socket.once('connect_error', (error) => {
            clearTimeout(timer);
            reject(new Error(String(error)));
          });
          socket.connect();
        });
        return socket;
      };
      try {
        const [first, second, other] = await Promise.all([
          connect(cashierA),
          connect(waiterA),
          connect(adminB),
        ]);
        const foreign = jest.fn();
        other.on('order.created', foreign);
        const receive = (socket: Socket) =>
          new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Event delivery timeout')),
              5000,
            );
            socket.once('order.created', (payload) => {
              clearTimeout(timer);
              resolve(payload);
            });
          });
        const received = Promise.all([receive(first), receive(second)]);
        app
          .get(RealtimeGateway)
          .emitOrderEvent(branchAId, 'order.created', { id: 'delivery-test' });
        expect(await received).toEqual([
          { id: 'delivery-test' },
          { id: 'delivery-test' },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(foreign).not.toHaveBeenCalled();
      } finally {
        sockets.forEach((socket) => socket.disconnect());
      }
    });

    it('routes production tickets by kitchen and bar station', async () => {
      await prisma.product.update({
        where: { id: productAId },
        data: { preparationStation: 'KITCHEN' },
      });
      await prisma.product.update({
        where: { id: productBId },
        data: { preparationStation: 'BAR' },
      });
      const order = await createOrder(waiterA, {
        items: [
          { productId: productAId, quantity: 1 },
          { productId: productBId, quantity: 1 },
        ],
      });
      for (const [kind, productId] of [
        ['kitchen', productAId],
        ['bar', productBId],
      ]) {
        const result = await request(server)
          .get(`/api/v1/print/order/${order.id}/${kind}`)
          .set('Authorization', auth(cashierA))
          .expect(200);
        const ticket = responseData<{ items: Array<{ id: string }> }>(result);
        expect(ticket.items).toHaveLength(1);
        expect(ticket.items[0].id).toBe(
          order.items.find((item) => item.productId === productId)?.id,
        );
      }
    });

    it('subtracts stock for every repeated product line', async () => {
      const before = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: inventoryItemId },
      });
      const order = await createOrder(waiterA, {
        items: [
          { productId: inventoryProductId, quantity: 1, notes: 'uno' },
          { productId: inventoryProductId, quantity: 1, notes: 'dos' },
        ],
      });
      await pay(cashierA, order.id, Number(order.total));
      const after = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: inventoryItemId },
      });
      expect(Number(after.currentStock)).toBe(Number(before.currentStock) - 2);
    });

    it('supports cashier and superadmin child entry and prevents duplicate overtime checkout', async () => {
      await prisma.setting.createMany({
        data: [
          {
            branchId: branchAId,
            key: 'child_hourly_product_id',
            value: productAId,
          },
          {
            branchId: branchAId,
            key: 'child_extra_half_hour_product_id',
            value: productBId,
          },
        ],
      });
      for (const session of [cashierA, superAdmin]) {
        const entry = await request(server)
          .post('/api/v1/child-access')
          .set('Authorization', auth(session))
          .send({
            branchId: branchAId,
            childName: 'Prueba entrega',
            guardianName: 'Tutor prueba',
            contractedMinutes: 60,
          })
          .expect(201);
        const child = responseData<{
          id: string;
          orderId: string;
          accessCode: string;
          baseAmount: string;
        }>(entry);
        expect(Number(child.baseAmount)).toBe(99);
        await prisma.childAccess.update({
          where: { id: child.id },
          data: { entryTime: new Date(Date.now() - 76 * 60000) },
        });
        const checkout = () =>
          request(server)
            .patch(`/api/v1/child-access/${child.id}/checkout`)
            .set('Authorization', auth(session))
            .send({ accessCode: child.accessCode });
        const responses = await Promise.all([checkout(), checkout()]);
        expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
        expect(responses.some((r) => [400, 409].includes(r.status))).toBe(true);
        const order = await prisma.order.findUniqueOrThrow({
          where: { id: child.orderId },
          include: { items: true },
        });
        expect(order.items).toHaveLength(2);
        expect(Number(order.total)).toBe(148);
        await pay(cashierA, order.id, 148);
      }
    });

    it('blocks final payment before child checkout and adds overtime to the original ticket', async () => {
      await prisma.product.update({
        where: { id: productAId },
        data: { preparationStation: 'NONE' },
      });
      const entry = await request(server)
        .post('/api/v1/child-access')
        .set('Authorization', auth(cashierA))
        .send({
          childName: 'Prepago QA',
          guardianName: 'Tutor QA',
          contractedMinutes: 60,
        })
        .expect(201);
      const child = responseData<{
        id: string;
        orderId: string;
        accessCode: string;
      }>(entry);
      await pay(cashierA, child.orderId, 99, 409);
      await prisma.childAccess.update({
        where: { id: child.id },
        data: { entryTime: new Date(Date.now() - 76 * 60000) },
      });
      const checkout = () =>
        request(server)
          .patch(`/api/v1/child-access/${child.id}/checkout`)
          .set('Authorization', auth(cashierA))
          .send({ accessCode: child.accessCode });
      const [first, second] = await Promise.all([checkout(), checkout()]);
      const success = [first, second].find(
        (response) => response.status === 200,
      );
      expect(success).toBeDefined();
      expect(
        [first, second].filter((response) => response.status === 200),
      ).toHaveLength(1);
      const result = responseData<{
        chargeOrderId: string;
        access: { orderId: string };
      }>(success!);
      expect(result.chargeOrderId).toBe(child.orderId);
      expect(result.access.orderId).toBe(child.orderId);
      const extra = await prisma.order.findUniqueOrThrow({
        where: { id: result.chargeOrderId },
      });
      expect(Number(extra.total)).toBe(148);
      const original = await prisma.order.findUniqueOrThrow({
        where: { id: child.orderId },
        include: { payments: true },
      });
      expect(Number(original.total)).toBe(148);
      expect(original.status).not.toBe('COMPLETED');
      expect(original.payments).toHaveLength(0);
      await pay(cashierA, extra.id, 148);
    });

    it('includes a concurrent payment in the cash close or rejects it without writing a payment', async () => {
      await request(server)
        .post('/api/v1/cash/open')
        .set('Authorization', auth(adminB))
        .send({ openingBalance: 0 })
        .expect(201);
      const order = await createOrder(adminB, {
        branchId: branchBId,
        items: [{ productId: productBId, quantity: 1 }],
      });
      const [payment, close] = await Promise.all([
        request(server)
          .post('/api/v1/payments')
          .set('Authorization', auth(adminB))
          .send({
            orderId: order.id,
            method: 'CARD',
            amount: Number(order.total),
          }),
        request(server)
          .patch('/api/v1/cash/close')
          .set('Authorization', auth(adminB))
          .send({ closingBalance: 0 }),
      ]);
      expect([201, 400, 409]).toContain(payment.status);
      expect(close.status).toBe(200);
      const shift = await prisma.shift.findFirstOrThrow({
        where: { branchId: branchBId },
        orderBy: { openedAt: 'desc' },
        include: { payments: true },
      });
      expect(shift.closedAt).not.toBeNull();
      expect(Number(shift.totalSales)).toBe(
        shift.payments.reduce((sum, item) => sum + Number(item.amount), 0),
      );
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(
        payment.status === 201 ? 1 : 0,
      );
    });

    it('preserves menu price and production station on edits', async () => {
      await request(server)
        .patch(`/api/v1/products/${productBId}`)
        .set('Authorization', auth(adminA))
        .send({ price: 27.5, preparationStation: 'BAR' })
        .expect(200);
      const result = await request(server)
        .get(`/api/v1/products/${productBId}`)
        .set('Authorization', auth(cashierA))
        .expect(200);
      const product = responseData<{
        price: string;
        preparationStation: string;
      }>(result);
      expect(Number(product.price)).toBe(27.5);
      expect(product.preparationStation).toBe('BAR');
    });
  });

  describe('branch scope', () => {
    it('blocks branch A user from branch B order and user', async () => {
      const branchBOrder = await createOrder(adminB, {
        branchId: branchBId,
        tableId: tableBId,
        items: [{ productId: productAId, quantity: 1 }],
      });
      await addItems(
        waiterA,
        branchBOrder.id,
        [{ productId: productAId, quantity: 1 }],
        404,
      );
      await request(server)
        .patch(`/api/v1/users/${adminBId}`)
        .set('Authorization', auth(adminA))
        .send({ firstName: 'Nope' })
        .expect(403);
    });
  });

  describe('cashier documents permissions', () => {
    it('lets waiter print enabled prebill but restricts business receipts and configuration to authorized roles', async () => {
      await request(server)
        .put('/api/v1/print/config')
        .set('Authorization', auth(adminA))
        .send({
          cashierPrinter: 'windows:///Caja QA',
          kitchenPrinter: 'windows:///Cocina QA',
          barPrinter: 'windows:///Barra QA',
          width: '80mm',
          autoKitchen: false,
          autoBar: false,
          autoCustomer: false,
          cashierMode: 'CUSTOMER_AND_BUSINESS',
          confirmClose: false,
          allowReprint: true,
        })
        .expect(200);
      await request(server)
        .put('/api/v1/print/config')
        .set('Authorization', auth(waiterA))
        .send({})
        .expect(403);
      const policy = await request(server)
        .get('/api/v1/print/cashier-policy')
        .set('Authorization', auth(waiterA))
        .expect(200);
      expect(responseData<Record<string, unknown>>(policy)).not.toHaveProperty(
        'cashierPrinter',
      );
      const order = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      const prebill = await request(server)
        .post(`/api/v1/print/order/${order.id}/prebill`)
        .set('Authorization', auth(waiterA))
        .send({ requestId: randomUUID() })
        .expect(201);
      expect(
        responseData<{ printerTarget: string }>(prebill).printerTarget,
      ).toBe('windows:///Caja QA');
      await request(server)
        .get(`/api/v1/print/order/${order.id}/business-receipt`)
        .set('Authorization', auth(waiterA))
        .expect(403);
      await request(server)
        .post(`/api/v1/print/order/${order.id}/business-receipt/print`)
        .set('Authorization', auth(waiterA))
        .send({ requestId: randomUUID(), reason: 'Not cashier' })
        .expect(403);
      await request(server)
        .post(`/api/v1/print/order/${order.id}/prebill`)
        .set('Authorization', auth(waiterA))
        .send({})
        .expect(400);
      await request(server)
        .get(`/api/v1/print/order/${order.id}/prebill`)
        .set('Authorization', auth(adminB))
        .expect(404);
      await pay(cashierA, order.id, Number(order.total));
      const receipt = await request(server)
        .get(`/api/v1/print/order/${order.id}/business-receipt`)
        .set('Authorization', auth(cashierA))
        .expect(200);
      expect(
        responseData<{ document: { cashierDocument: { kind: string } } }>(
          receipt,
        ).document.cashierDocument.kind,
      ).toBe('BUSINESS');
      await request(server)
        .get(`/api/v1/print/order/${order.id}/business-receipt`)
        .set('Authorization', auth(adminB))
        .expect(404);
    });
  });
});

if (!smokeDatabaseUrl) {
  describe.skip('PlayCoffee smoke e2e requires SMOKE_DATABASE_URL or TEST_DATABASE_URL', () => {
    it('set a dedicated test database url to run smoke tests', () => undefined);
  });
}
