import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrderStatus, UserRoleEnum } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@ApiTags('Orders')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: OrderStatus,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.ordersService.findAll(userBranchId ?? branchId, status);
  }

  @Get('summary')
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'date', required: false })
  getDailySummary(
    @Query('branchId') branchId: string,
    @Query('date') date?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.ordersService.getDailySummary(userBranchId ?? branchId, date);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.ordersService.findOne(id, userBranchId);
  }

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    const order = await this.ordersService.create(
      { ...dto, branchId: userBranchId ?? dto.branchId },
      userId,
    );
    this.realtime.emitOrderEvent(order.branchId, 'order.created', {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
    });
    return order;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser('branchId') userBranchId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    const order = await this.ordersService.updateStatus(
      id,
      dto,
      userBranchId,
      userId,
    );
    const event =
      order.status === OrderStatus.COMPLETED
        ? 'order.completed'
        : order.status === OrderStatus.CANCELLED
          ? 'order.cancelled'
          : order.status === OrderStatus.PREPARING
            ? 'order.sent_to_kitchen'
            : 'order.updated';
    this.realtime.emitOrderEvent(order.branchId, event, {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
    });
    if (event !== 'order.updated') {
      this.realtime.emitOrderEvent(order.branchId, 'order.updated', {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
      });
    }
    return order;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    await this.ordersService.cancel(id, userBranchId, userId);
  }
}
