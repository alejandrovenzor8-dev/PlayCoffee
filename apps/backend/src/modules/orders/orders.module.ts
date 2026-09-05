import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { PrintModule } from '../print/print.module';

@Module({
  imports: [InventoryModule, PrintModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
