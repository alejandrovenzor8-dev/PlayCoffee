import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CashService } from './cash.service';
import { CashMovementDto } from './dto/cash-movement.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { OpenShiftDto } from './dto/open-shift.dto';

@ApiTags('Cash')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER)
@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('open')
  open(
    @Body() dto: OpenShiftDto,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.cashService.open(branchId, userId, dto);
  }

  @Get('current')
  current(@CurrentUser('branchId') branchId: string) {
    return this.cashService.getCurrent(branchId);
  }

  @Post('movements')
  movement(
    @Body() dto: CashMovementDto,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.cashService.addMovement(branchId, userId, dto);
  }

  @Patch('close')
  close(
    @Body() dto: CloseShiftDto,
    @CurrentUser('branchId') branchId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.cashService.close(branchId, userId, dto);
  }

  @Get('history')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  history(
    @CurrentUser('branchId') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cashService.list(branchId, from, to);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser('branchId') branchId: string) {
    return this.cashService.getDetail(id, branchId);
  }
}
