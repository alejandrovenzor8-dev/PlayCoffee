// Only for an empty, migrated database. Never run the demonstration seed here.
const { PrismaClient } = require('../../apps/backend/node_modules/@prisma/client');
const bcrypt = require('../../apps/backend/node_modules/bcrypt');

async function initializeDatabase(prisma, options) {
  const { email, password, branchName, hourlyRate, extraRate } = options;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
    throw new Error('Indica un correo valido y una contrasena de administrador de al menos 12 caracteres.');
  }
  if (!branchName || ![hourlyRate, extraRate].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Indica el nombre de la sucursal y tarifas infantiles mayores a cero.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async tx => {
    const migrationProductIds = ['prod-child-hour', 'prod-child-extra-30'];
    if (await tx.branch.count() || await tx.user.count() || await tx.order.count() || await tx.category.count() ||
        await tx.product.count({ where: { id: { notIn: migrationProductIds } } })) {
      throw new Error('La base ya contiene datos. Se cancela la inicializacion sin modificarlos.');
    }
    const branch = await tx.branch.create({ data: { name: branchName, currency: 'MXN', timezone: 'America/Mexico_City' } });
    await tx.user.create({ data: { branchId: branch.id, email: email.toLowerCase().trim(), passwordHash, firstName: 'Administrador', lastName: 'PlayCoffee', role: 'SUPER_ADMIN' } });
    // A historical migration installs these two billing concepts before the branch exists.
    const hourlyData = { name: 'Area infantil - hora', price: hourlyRate, preparationStation: 'NONE' };
    const extraData = { name: 'Area infantil - media hora extra', price: extraRate, preparationStation: 'NONE' };
    const hourly = await tx.product.upsert({ where: { id: migrationProductIds[0] }, update: hourlyData, create: { id: migrationProductIds[0], ...hourlyData } });
    const extra = await tx.product.upsert({ where: { id: migrationProductIds[1] }, update: extraData, create: { id: migrationProductIds[1], ...extraData } });
    await tx.setting.createMany({ data: [
      ['child_hourly_product_id', hourly.id], ['child_extra_half_hour_product_id', extra.id],
      ['child_hourly_rate', String(hourlyRate)], ['child_extra_half_hour_rate', String(extraRate)],
    ].map(([key, value]) => ({ branchId: branch.id, key, value, group: 'child_access' })) });
    return branch.id;
  }, { isolationLevel: 'Serializable', timeout: 30000 });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  initializeDatabase(prisma, {
    email: process.env.SETUP_ADMIN_EMAIL, password: process.env.SETUP_ADMIN_PASSWORD,
    branchName: process.env.SETUP_BRANCH_NAME,
    hourlyRate: Number(process.env.SETUP_CHILD_HOURLY), extraRate: Number(process.env.SETUP_CHILD_EXTRA),
  }).then(() => console.log('Base nueva lista: administrador y tarifas infantiles. Sin ventas ni menu de demostracion.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
module.exports = { initializeDatabase };
