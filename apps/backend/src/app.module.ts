import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { AreasModule } from './modules/areas/areas.module';
import { TablesModule } from './modules/tables/tables.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ChildAccessModule } from './modules/child-access/child-access.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { CashModule } from './modules/cash/cash.module';
import { PrintModule } from './modules/print/print.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    BranchesModule,
    UsersModule,
    ProductsModule,
    AreasModule,
    TablesModule,
    OrdersModule,
    PaymentsModule,
    CashModule,
    PrintModule,
    InventoryModule,
    ChildAccessModule,
    ReservationsModule,
    ReportsModule,
  ],
})
export class AppModule {}
