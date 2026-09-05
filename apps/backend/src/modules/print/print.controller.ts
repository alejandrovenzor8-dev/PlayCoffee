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

@ApiTags('Print')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

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
