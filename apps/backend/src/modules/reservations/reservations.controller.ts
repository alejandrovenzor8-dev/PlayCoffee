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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReservationStatus, UserRoleEnum } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Reservations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'date', required: false })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.findAll(userBranchId ?? branchId, date);
  }

  @Post()
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.create({
      ...dto,
      branchId: userBranchId ?? dto.branchId,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ReservationStatus,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.updateStatus(id, status, userBranchId);
  }

  @Delete(':id')
  cancel(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.cancel(id, userBranchId);
  }
}
