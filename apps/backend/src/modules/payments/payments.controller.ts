import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';

@ApiTags('Payments')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('config')
  getConfig(@CurrentUser('branchId') branchId?: string) {
    return this.paymentsService.getPaymentConfig(branchId);
  }

  @Put('config')
  @Roles(UserRoleEnum.ADMIN)
  updateConfig(
    @CurrentUser('branchId') branchId: string,
    @Body() dto: UpdatePaymentConfigDto,
  ) {
    return this.paymentsService.updatePaymentConfig(branchId, dto);
  }

  @Post()
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.paymentsService.create(dto, userId, userBranchId);
  }

  @Get('order/:orderId')
  findByOrder(
    @Param('orderId') orderId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.paymentsService.findByOrder(orderId, userBranchId);
  }
}
