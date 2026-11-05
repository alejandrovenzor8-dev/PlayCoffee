import { CorrectOrderItemDto } from './dto/correct-order-item.dto';
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
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrderStatus, UserRoleEnum } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@ApiTags('Orders')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER, UserRoleEnum.COOK)
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
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
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

  @Post(':id/items')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  async addItems(
    @Param('id') id: string,
    @Body() dto: AddOrderItemsDto,
    @CurrentUser('branchId') userBranchId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    const order = await this.ordersService.addItems(
      id,
      dto.items,
      userBranchId,
      userId,
      dto.requestId,
    );
    this.realtime.emitOrderEvent(order.branchId, 'order.sent_to_kitchen', {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
    });
    this.realtime.emitOrderEvent(order.branchId, 'order.updated', {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
    });
    return order;
  }

  @Patch(':id/items/:itemId')
  @Roles(UserRoleEnum.WAITER, UserRoleEnum.CASHIER)
  async correctItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CorrectOrderItemDto,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRoleEnum,
  ) {
    const order = await this.ordersService.correctItem(
      id,
      itemId,
      dto,
      branchId,
      userId,
      role,
    );
    this.realtime.emitOrderEvent(branchId, 'order.updated', { id });
    return order;
  }

  @Delete(':id')
  @Roles(UserRoleEnum.CASHIER, UserRoleEnum.WAITER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    const order = await this.ordersService.cancel(id, userBranchId, userId);
    this.realtime.emitOrderEvent(order.branchId, 'order.cancelled', {
      id: order.id,
      status: order.status,
    });
  }
}
