import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PlayCoffee database...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const branch = await prisma.branch.upsert({
    where: { id: 'branch-1' },
    update: {
      name: 'PlayCoffee Centro',
      address: 'Av. Principal 123, Ciudad de Mexico',
      phone: '+52 55 1234 5678',
      email: 'hola@playcoffee.mx',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: 'branch-1',
      name: 'PlayCoffee Centro',
      address: 'Av. Principal 123, Ciudad de Mexico',
      phone: '+52 55 1234 5678',
      email: 'hola@playcoffee.mx',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nexorh.com' },
    update: {
      branchId: branch.id,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: 'admin@nexorh.com',
      branchId: branch.id,
      firstName: 'Admin',
      lastName: 'System',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const categories = [
    { id: 'cat-bebidas', name: 'Bebidas', color: '#2563eb', sortOrder: 0 },
    { id: 'cat-alimentos', name: 'Alimentos', color: '#059669', sortOrder: 1 },
    { id: 'cat-postres', name: 'Postres', color: '#d97706', sortOrder: 2 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { ...category, isActive: true, deletedAt: null },
      create: category,
    });
  }

  const products = [
    {
      id: 'prod-cappuccino',
      categoryId: 'cat-bebidas',
      name: 'Cappuccino',
      price: 65,
      cost: 24,
      sku: 'CAF-CAP',
      isFeatured: true,
      sortOrder: 0,
    },
    {
      id: 'prod-latte',
      categoryId: 'cat-bebidas',
      name: 'Latte',
      price: 70,
      cost: 25,
      sku: 'CAF-LAT',
      isFeatured: true,
      sortOrder: 1,
    },
    {
      id: 'prod-americano',
      categoryId: 'cat-bebidas',
      name: 'Americano',
      price: 45,
      cost: 15,
      sku: 'CAF-AME',
      isFeatured: false,
      sortOrder: 2,
    },
    {
      id: 'prod-matcha',
      categoryId: 'cat-bebidas',
      name: 'Matcha Latte',
      price: 85,
      cost: 34,
      sku: 'CAF-MAT',
      isFeatured: true,
      sortOrder: 3,
    },
    {
      id: 'prod-toast',
      categoryId: 'cat-alimentos',
      name: 'Avocado Toast',
      price: 110,
      cost: 48,
      sku: 'ALI-AVO',
      isFeatured: false,
      sortOrder: 0,
    },
    {
      id: 'prod-waffle',
      categoryId: 'cat-alimentos',
      name: 'Waffle',
      price: 95,
      cost: 36,
      sku: 'ALI-WAF',
      isFeatured: false,
      sortOrder: 1,
    },
    {
      id: 'prod-cheesecake',
      categoryId: 'cat-postres',
      name: 'Cheesecake',
      price: 75,
      cost: 30,
      sku: 'POS-CHE',
      isFeatured: false,
      sortOrder: 0,
    },
    {
      id: 'prod-brownie',
      categoryId: 'cat-postres',
      name: 'Brownie',
      price: 60,
      cost: 22,
      sku: 'POS-BRO',
      isFeatured: false,
      sortOrder: 1,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: { ...product, isActive: true, deletedAt: null },
      create: product,
    });
  }

  const areas = [
    { id: 'area-salon', name: 'Salon Principal', color: '#2563eb', order: 0 },
    { id: 'area-terraza', name: 'Terraza', color: '#059669', order: 1 },
    { id: 'area-infantil', name: 'Area Infantil', color: '#d97706', order: 2 },
  ];

  for (const area of areas) {
    await prisma.tableArea.upsert({
      where: { id: area.id },
      update: { ...area, branchId: branch.id, isActive: true, deletedAt: null },
      create: { ...area, branchId: branch.id },
    });
  }

  const tables = [
    { id: 'table-salon-1', areaId: 'area-salon', number: '1', capacity: 4, posX: 80, posY: 80 },
    { id: 'table-salon-2', areaId: 'area-salon', number: '2', capacity: 4, posX: 240, posY: 80 },
    { id: 'table-salon-3', areaId: 'area-salon', number: '3', capacity: 6, posX: 400, posY: 80, width: 150 },
    { id: 'table-terraza-1', areaId: 'area-terraza', number: 'T1', capacity: 2, posX: 90, posY: 120, shape: 'circle' },
    { id: 'table-terraza-2', areaId: 'area-terraza', number: 'T2', capacity: 4, posX: 250, posY: 120, shape: 'circle' },
    { id: 'table-infantil-1', areaId: 'area-infantil', number: 'K1', capacity: 6, posX: 120, posY: 120, width: 160 },
  ];

  for (const table of tables) {
    await prisma.restaurantTable.upsert({
      where: { id: table.id },
      update: { ...table, status: 'AVAILABLE', isActive: true, deletedAt: null },
      create: table,
    });
  }

  console.log('Seed completed:', {
    branch: branch.id,
    admin: adminUser.email,
    categories: categories.length,
    products: products.length,
    areas: areas.length,
    tables: tables.length,
  });

  console.log('\nCredentials:');
  console.log('   Email: admin@nexorh.com');
  console.log('   Password: admin123');
  console.log(`   Branch: ${branch.id}\n`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
