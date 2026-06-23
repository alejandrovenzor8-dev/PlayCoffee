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
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reportsService.getSummary(userBranchId ?? branchId, from, to);
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
