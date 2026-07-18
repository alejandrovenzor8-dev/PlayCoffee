import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentMethod, PrismaClient, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

const smokeDatabaseUrl =
  process.env.SMOKE_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const describeSmoke = smokeDatabaseUrl ? describe : describe.skip;

type AuthSession = { token: string; user: Record<string, unknown> };
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
  summary: { paymentStatus: string };
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
    await app.init();

    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await seedSmokeData(prisma);

    superAdmin = await login('super.smoke@example.com');
    adminA = await login('admin-a.smoke@example.com');
    adminB = await login('admin-b.smoke@example.com');
    cashierA = await login('cashier-a.smoke@example.com');
    waiterA = await login('waiter-a.smoke@example.com');
  });

  afterAll(async () => {
    await cleanupSmokeData(prisma);
    await prisma.$disconnect();
    await app.close();
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
          email: 'super.smoke@example.com',
          firstName: 'Super',
          lastName: 'Smoke',
          passwordHash,
          role: UserRoleEnum.SUPER_ADMIN,
        },
        {
          id: adminAId,
          branchId: branchAId,
          email: 'admin-a.smoke@example.com',
          firstName: 'Admin',
          lastName: 'A',
          passwordHash,
          role: UserRoleEnum.ADMIN,
        },
        {
          id: adminBId,
          branchId: branchBId,
          email: 'admin-b.smoke@example.com',
          firstName: 'Admin',
          lastName: 'B',
          passwordHash,
          role: UserRoleEnum.ADMIN,
        },
        {
          id: cashierAId,
          branchId: branchAId,
          email: 'cashier-a.smoke@example.com',
          firstName: 'Cashier',
          lastName: 'A',
          passwordHash,
          role: UserRoleEnum.CASHIER,
        },
        {
          id: waiterAId,
          branchId: branchAId,
          email: 'waiter-a.smoke@example.com',
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
  }

  async function cleanupSmokeData(db: PrismaClient) {
    await db.payment.deleteMany({
      where: { order: { orderNumber: { startsWith: 'PC-' } } },
    });
    await db.order.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await db.restaurantTable.deleteMany({
      where: { id: { in: [tableAId, tableBId] } },
    });
    await db.tableArea.deleteMany({
      where: { id: { in: [areaAId, areaBId] } },
    });
    await db.user.deleteMany({
      where: {
        email: {
          in: [
            'super.smoke@example.com',
            'admin-a.smoke@example.com',
            'admin-b.smoke@example.com',
            'cashier-a.smoke@example.com',
            'waiter-a.smoke@example.com',
          ],
        },
      },
    });
    await db.product.deleteMany({
      where: {
        id: {
          in: [productAId, productBId, inactiveProductId, deletedProductId],
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
      user: Record<string, unknown>;
    }>(response);
    return {
      token: data.accessToken,
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
        .expect(400);

      const completed = await createOrder(waiterA, {
        items: [{ productId: productAId, quantity: 1 }],
      });
      await pay(cashierA, completed.id, 65);
      await request(server)
        .patch(`/api/v1/orders/${completed.id}`)
        .set('Authorization', auth(waiterA))
        .send({ status: 'READY' })
        .expect(400);
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
});

if (!smokeDatabaseUrl) {
  describe.skip('PlayCoffee smoke e2e requires SMOKE_DATABASE_URL or TEST_DATABASE_URL', () => {
    it('set a dedicated test database url to run smoke tests', () => undefined);
  });
}
