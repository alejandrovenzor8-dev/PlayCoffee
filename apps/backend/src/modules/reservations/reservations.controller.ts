import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReservationStatus } from '@prisma/client';

@ApiTags('Reservations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'date', required: false })
  findAll(@Query('branchId') branchId?: string, @Query('date') date?: string) {
    return this.reservationsService.findAll(branchId, date);
  }

  @Post()
  create(@Body() dto: CreateReservationDto) { return this.reservationsService.create(dto); }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: ReservationStatus) {
    return this.reservationsService.updateStatus(id, status);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) { return this.reservationsService.cancel(id); }
}
