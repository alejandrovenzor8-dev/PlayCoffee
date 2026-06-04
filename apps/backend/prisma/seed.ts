import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password
  const passwordHash = await bcrypt.hash('admin123', 10);

  // Create super admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nexorh.com' },
    update: {},
    create: {
      email: 'admin@nexorh.com',
      firstName: 'Admin',
      lastName: 'System',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Super Admin created:', {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  console.log('\n📝 Credentials:');
  console.log('   Email: admin@nexorh.com');
  console.log('   Password: admin123');
  console.log('   Role: SUPER_ADMIN\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
