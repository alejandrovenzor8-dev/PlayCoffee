const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('../../apps/backend/node_modules/@prisma/client');
const bcrypt = require('../../apps/backend/node_modules/bcrypt');
const { initializeDatabase } = require('./initialize-database.cjs');

test('fresh installation creates only operational essentials and refuses to reseed', { timeout: 60000 }, async () => {
  const databaseUrl = new URL(process.env.SMOKE_DATABASE_URL);
  assert.match(databaseUrl.pathname, /smoke|test/, 'Run only against the dedicated test database');
  assert.ok(['localhost', '127.0.0.1'].includes(databaseUrl.hostname));
  // Some historical migrations explicitly target public. Use a separate database,
  // not a schema within the smoke database, so they cannot reach existing fixtures.
  const database = `installer_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });
  databaseUrl.pathname = `/${database}`;
  databaseUrl.searchParams.set('schema', 'public');
  const url = databaseUrl.toString();
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const options = { email: 'installation@example.test', password: randomUUID(), branchName: 'Installation test', hourlyRate: 120.50, extraRate: 55.25 };
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    execFileSync(process.execPath, [path.resolve(__dirname, '../../apps/backend/node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '../../apps/backend'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', timeout: 40000,
    });
    await assert.rejects(initializeDatabase(prisma, { ...options, password: 'short' }), /12 caracteres/);
    assert.equal(await prisma.branch.count(), 0);
    await initializeDatabase(prisma, options);
    assert.equal(await prisma.user.count(), 1);
    const user = await prisma.user.findFirst();
    assert.equal(user.role, 'SUPER_ADMIN');
    assert.equal(user.email, options.email);
    assert.equal(await bcrypt.compare(options.password, user.passwordHash), true);
    assert.equal(await prisma.order.count(), 0);
    assert.equal(await prisma.payment.count(), 0);
    assert.equal(await prisma.shift.count(), 0, 'Operator must open the first shift');
    const products = await prisma.product.findMany();
    assert.equal(products.length, 2);
    assert.ok(products.every(product => product.preparationStation === 'NONE'));
    const settings = await prisma.setting.findMany();
    assert.equal(settings.length, 4);
    const hourlyId = settings.find(setting => setting.key === 'child_hourly_product_id').value;
    assert.equal(Number(products.find(product => product.id === hourlyId).price), 120.5);
    await assert.rejects(initializeDatabase(prisma, options), /ya contiene datos/);
    assert.equal(await prisma.user.count(), 1);
    assert.equal(await prisma.product.count(), 2);
  } finally {
    await prisma.$disconnect();
    // Only remove this invocation's randomly named, isolated test database.
    assert.match(database, /^installer_test_[a-f0-9]{32}$/);
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.$disconnect();
  }
});
