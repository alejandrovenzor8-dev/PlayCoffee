import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrintService } from './print.service';

@ApiTags('Print')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

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
}
