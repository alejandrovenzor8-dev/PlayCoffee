import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationStatus } from '@prisma/client';

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string, date?: string) {
    const targetDate = date ? new Date(date) : undefined;
    const start = targetDate ? new Date(targetDate.setHours(0, 0, 0, 0)) : undefined;
    const end = targetDate ? new Date(targetDate.setHours(23, 59, 59, 999)) : undefined;

    return this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(start && end ? { reservedAt: { gte: start, lte: end } } : {}),
      },
      include: { table: true, package: true },
      orderBy: { reservedAt: 'asc' },
    });
  }

  async create(dto: CreateReservationDto) {
    return this.prisma.reservation.create({
      data: { ...dto, reservedAt: new Date(dto.reservedAt) },
      include: { table: true, package: true },
    });
  }

  async updateStatus(id: string, status: ReservationStatus, branchId?: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return this.prisma.reservation.update({ where: { id }, data: { status } });
  }

  async cancel(id: string, branchId?: string) {
    return this.updateStatus(id, ReservationStatus.CANCELLED, branchId);
  }
}
