import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  getSummary(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.getSummary(
      userBranchId ?? branchId,
      start ?? from,
      end ?? to,
    );
  }

  @Get('sales-by-day')
  getSalesByDay(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.salesByDay(userBranchId ?? branchId, start, end);
  }

  @Get('sales-by-category')
  getSalesByCategory(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.salesByCategory(
      userBranchId ?? branchId,
      start,
      end,
    );
  }

  @Get('payment-methods')
  getPaymentMethods(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.paymentMethods(
      userBranchId ?? branchId,
      start,
      end,
    );
  }

  @Get('peak-hours')
  getPeakHours(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.peakHours(userBranchId ?? branchId, start, end);
  }

  @Get('waiter-sales')
  getWaiterSales(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.waiterSales(
      userBranchId ?? branchId,
      start,
      end,
    );
  }

  @Get('child-access')
  getChildAccess(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.childAccess(
      userBranchId ?? branchId,
      start,
      end,
    );
  }

  @Get('reservations')
  getReservations(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.reservations(
      userBranchId ?? branchId,
      start,
      end,
    );
  }

  @Get('inventory-low-stock')
  getInventoryLowStock(
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.inventoryLowStock(userBranchId ?? branchId);
  }

  @Get('cash-shifts')
  getCashShifts(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.cashShifts(userBranchId ?? branchId, start, end);
  }

  @Get('kpis')
  @ApiQuery({ name: 'branchId', required: true })
  getKpis(
    @Query('branchId') branchId: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.getKpis(userBranchId ?? branchId);
  }

  @Get('sales')
  @ApiQuery({ name: 'branchId', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getSalesSummary(
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.getSalesSummary(
      userBranchId ?? branchId,
      from,
      to,
    );
  }
}
