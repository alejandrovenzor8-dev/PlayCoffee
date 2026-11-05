import {
  QueuePrebillDto,
  BusinessReceiptPrintDto,
} from './dto/cashier-document.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrintService } from './print.service';
import { QueuePrintJobDto } from './dto/queue-print-job.dto';
import { UpdatePrintConfigDto } from './dto/update-print-config.dto';
import { TestPrinterDto } from './dto/test-printer.dto';
import { discoverPrinters } from './printer-discovery';
import { ReprintDto } from './dto/reprint.dto';

@ApiTags('Print')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Get('cashier-policy')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  policy(@CurrentUser('branchId') branchId: string) {
    return this.printService.getCashierPolicy(branchId);
  }

  @Get('order/:orderId/prebill')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  prebill(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.getPrebill(orderId, branchId);
  }

  @Post('order/:orderId/prebill')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  queuePrebill(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
    @Body() dto: QueuePrebillDto,
  ) {
    return this.printService.queuePrebill(orderId, branchId, dto.requestId);
  }

  @Get('order/:orderId/business-receipt')
  @Roles(UserRoleEnum.CASHIER)
  receipt(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.getBusinessReceipt(orderId, branchId);
  }

  @Post('order/:orderId/business-receipt/print')
  @Roles(UserRoleEnum.CASHIER)
  printReceipt(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BusinessReceiptPrintDto,
  ) {
    return this.printService.printBusinessReceipt(
      orderId,
      branchId,
      userId,
      dto.requestId,
      dto.reason,
    );
  }

  @Get('order/:orderId/batches')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  batches(
    @Param('orderId') id: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.listBatches(id, branchId);
  }

  @Post('batches/:id/reprint')
  @Roles(UserRoleEnum.CASHIER)
  reprint(
    @Param('id') id: string,
    @Body() dto: ReprintDto,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.printService.reprintBatch(id, branchId, userId, dto.reason);
  }

  @Get('printers')
  @Roles(UserRoleEnum.ADMIN)
  printers() {
    return discoverPrinters();
  }

  @Post('test')
  @Roles(UserRoleEnum.ADMIN)
  testPrinter(
    @CurrentUser('branchId') branchId: string,
    @Body() dto: TestPrinterDto,
  ) {
    return this.printService.testPrinter(branchId, dto);
  }

  @Get('jobs/:id')
  @Roles(UserRoleEnum.ADMIN)
  job(@CurrentUser('branchId') branchId: string, @Param('id') id: string) {
    return this.printService.getJobStatus(branchId, id);
  }

  @Get('config')
  @Roles(UserRoleEnum.ADMIN)
  getConfig(@CurrentUser('branchId') branchId: string) {
    return this.printService.getPrintConfig(branchId);
  }

  @Put('config')
  @Roles(UserRoleEnum.ADMIN)
  updateConfig(
    @CurrentUser('branchId') branchId: string,
    @Body() dto: UpdatePrintConfigDto,
  ) {
    return this.printService.updatePrintConfig(branchId, dto);
  }

  @Get('order/:orderId/customer')
  @Roles(UserRoleEnum.CASHIER)
  getCustomerTicket(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.getCustomerTicket(orderId, branchId);
  }

  @Get('order/:orderId/kitchen')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  getKitchenTicket(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.getKitchenTicket(orderId, branchId);
  }

  @Get('order/:orderId/bar')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  getBarTicket(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.getBarTicket(orderId, branchId);
  }

  @Post('order/:orderId/queue')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  queueTicket(
    @Param('orderId') orderId: string,
    @Body() dto: QueuePrintJobDto,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.printService.queueTicket(orderId, branchId, dto.type);
  }
}
