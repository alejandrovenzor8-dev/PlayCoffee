import {
  BadRequestException,
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
import {
  CreateReservationDto,
  UpdateReservationDto,
} from './dto/create-reservation.dto';
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
  @ApiQuery({ name: 'status', required: false, enum: ReservationStatus })
  findAll(
    @Query('branchId') branchId?: string,
    @Query('date') date?: string,
    @Query('status') status?: ReservationStatus,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.findAll(
      userBranchId ?? branchId,
      date,
      status,
    );
  }

  @Get('calendar')
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  calendar(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    const scopedBranchId = userBranchId ?? branchId;
    if (!scopedBranchId) throw new BadRequestException('branchId is required');
    return this.reservationsService.calendar(scopedBranchId, start, end);
  }

  @Get('availability')
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({ name: 'duration', required: false })
  availability(
    @Query('date') date: string,
    @Query('areaId') areaId?: string,
    @Query('duration') duration?: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    const scopedBranchId = userBranchId ?? branchId;
    if (!scopedBranchId) throw new BadRequestException('branchId is required');
    return this.reservationsService.availability(
      scopedBranchId,
      date,
      areaId,
      duration ? Number(duration) : undefined,
    );
  }

  @Post()
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    const branchId = userBranchId ?? dto.branchId;
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.reservationsService.create({
      ...dto,
      branchId,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.update(id, dto, userBranchId);
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
