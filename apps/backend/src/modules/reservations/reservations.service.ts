import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePartyPackageDto,
  CreateReservationDto,
  UpdatePartyPackageDto,
  UpdateReservationDto,
} from './dto/create-reservation.dto';
import { Prisma, ReservationStatus } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const blockingStatuses: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.ARRIVED,
];

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async findAll(branchId?: string, date?: string, status?: ReservationStatus) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const range = date ? this.dayRange(new Date(date)) : null;

    return this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        branchId,
        ...(status ? { status } : {}),
        ...(range ? { reservedAt: { gte: range.start, lte: range.end } } : {}),
      },
      include: this.reservationInclude(),
      orderBy: { reservedAt: 'asc' },
    });
  }

  async calendar(branchId: string, start?: string, end?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const startDate = start ? new Date(start) : this.dayRange(new Date()).start;
    const endDate = end
      ? new Date(end)
      : new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 30);

    return this.prisma.reservation.findMany({
      where: {
        branchId,
        deletedAt: null,
        reservedAt: { lt: endDate },
        OR: [{ endTime: { gt: startDate } }, { endTime: null }],
      },
      include: this.reservationInclude(),
      orderBy: { reservedAt: 'asc' },
    });
  }

  async availability(
    branchId: string,
    date: string,
    areaId?: string,
    duration = 120,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    if (!date) throw new BadRequestException('date is required');
    if (duration < 30) throw new BadRequestException('duration is invalid');
    if (areaId) await this.validateArea(branchId, areaId);

    const day = new Date(date);
    const start = new Date(day);
    start.setHours(10, 0, 0, 0);
    const close = new Date(day);
    close.setHours(22, 0, 0, 0);

    const slots: Array<{ start: Date; end: Date; available: boolean }> = [];
    for (
      let cursor = new Date(start);
      cursor.getTime() + duration * 60000 <= close.getTime();
      cursor = new Date(cursor.getTime() + 30 * 60000)
    ) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      const conflict = areaId
        ? await this.hasOverlap(branchId, areaId, cursor, slotEnd)
        : false;
      slots.push({ start: cursor, end: slotEnd, available: !conflict });
    }
    return slots;
  }

  async create(dto: CreateReservationDto & { branchId: string }) {
    const normalized = await this.normalizeReservationInput(dto);
    await this.validateReservationRules(normalized);

    const reservation = await this.prisma.reservation.create({
      data: normalized.data,
      include: this.reservationInclude(),
    });
    this.realtime.emitReservationEvent(
      reservation.branchId,
      'reservation.created',
      {
        id: reservation.id,
        status: reservation.status,
        reservedAt: reservation.reservedAt,
      },
    );
    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const current = await this.prisma.reservation.findFirst({
      where: { id, branchId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Reservation not found');

    const merged = {
      branchId,
      areaId: dto.areaId ?? current.areaId ?? undefined,
      tableId: dto.tableId ?? current.tableId ?? undefined,
      packageId: dto.packageId ?? current.packageId ?? undefined,
      orderId: dto.orderId ?? current.orderId ?? undefined,
      contactName: dto.contactName ?? current.contactName,
      contactPhone: dto.contactPhone ?? current.contactPhone,
      contactEmail: dto.contactEmail ?? current.contactEmail ?? undefined,
      partySize: dto.partySize ?? current.partySize,
      reservedAt: dto.reservedAt ?? current.reservedAt.toISOString(),
      endTime: dto.endTime ?? current.endTime?.toISOString(),
      duration: dto.duration ?? current.duration,
      occasion: dto.occasion ?? current.occasion ?? undefined,
      notes: dto.notes ?? current.notes ?? undefined,
      depositAmount:
        dto.depositAmount === undefined
          ? Number(current.depositAmount)
          : dto.depositAmount,
      totalAmount:
        dto.totalAmount === undefined
          ? Number(current.totalAmount)
          : dto.totalAmount,
      status: dto.status ?? current.status,
      depositPaid: dto.depositPaid ?? current.depositPaid,
    };
    const normalized = await this.normalizeReservationInput(merged);
    await this.validateReservationRules(normalized, id);

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: {
        ...normalized.data,
        status: merged.status,
        depositPaid: merged.depositPaid,
      },
      include: this.reservationInclude(),
    });
    this.realtime.emitReservationEvent(
      reservation.branchId,
      reservation.status === ReservationStatus.CANCELLED
        ? 'reservation.cancelled'
        : 'reservation.updated',
      {
        id: reservation.id,
        status: reservation.status,
        reservedAt: reservation.reservedAt,
      },
    );
    return reservation;
  }

  async updateStatus(id: string, status: ReservationStatus, branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, deletedAt: null, branchId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const updated = await this.prisma.reservation.update({
      where: { id },
      data: { status },
      include: this.reservationInclude(),
    });
    this.realtime.emitReservationEvent(
      updated.branchId,
      status === ReservationStatus.CANCELLED
        ? 'reservation.cancelled'
        : 'reservation.updated',
      {
        id: updated.id,
        status: updated.status,
        reservedAt: updated.reservedAt,
      },
    );
    return updated;
  }

  async cancel(id: string, branchId?: string) {
    return this.updateStatus(id, ReservationStatus.CANCELLED, branchId);
  }

  async findPackages(branchId?: string, includeInactive = false) {
    return this.prisma.partyPackage.findMany({
      where: {
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
        OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createPackage(dto: CreatePartyPackageDto & { branchId?: string }) {
    if (dto.minDeposit !== undefined && dto.minDeposit > dto.price) {
      throw new BadRequestException(
        'Minimum deposit cannot exceed package price',
      );
    }
    return this.prisma.partyPackage.create({
      data: {
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        maxGuests: dto.maxGuests,
        duration: dto.duration,
        minDeposit: dto.minDeposit,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePackage(
    id: string,
    dto: UpdatePartyPackageDto,
    branchId?: string,
  ) {
    const current = await this.prisma.partyPackage.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      },
    });
    if (!current) throw new NotFoundException('Party package not found');
    const price = dto.price ?? Number(current.price);
    const minDeposit =
      dto.minDeposit === undefined
        ? Number(current.minDeposit ?? 0)
        : dto.minDeposit;
    if (minDeposit > price) {
      throw new BadRequestException(
        'Minimum deposit cannot exceed package price',
      );
    }
    return this.prisma.partyPackage.update({
      where: { id },
      data: dto,
    });
  }

  async removePackage(id: string, branchId?: string) {
    const current = await this.prisma.partyPackage.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Party package not found');
    return this.prisma.partyPackage.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async normalizeReservationInput(
    dto: CreateReservationDto & { branchId: string },
  ) {
    if (!dto.branchId) throw new BadRequestException('branchId is required');
    if (!dto.contactName?.trim()) {
      throw new BadRequestException('Customer name is required');
    }
    if (!dto.contactPhone?.trim()) {
      throw new BadRequestException('Customer phone is required');
    }

    const packageData = dto.packageId
      ? await this.validatePackage(dto.branchId, dto.packageId)
      : null;
    const areaId = await this.resolveAreaId(
      dto.branchId,
      dto.areaId,
      dto.tableId,
    );
    const startTime = new Date(dto.reservedAt);
    const duration = packageData?.duration ?? dto.duration;
    const endTime = packageData
      ? new Date(startTime.getTime() + packageData.duration * 60000)
      : dto.endTime
        ? new Date(dto.endTime)
        : duration
          ? new Date(startTime.getTime() + duration * 60000)
          : null;

    if (!endTime || endTime <= startTime) {
      throw new BadRequestException(
        'Reservation end time must be after start time',
      );
    }

    const totalAmount = dto.totalAmount ?? Number(packageData?.price ?? 0);
    const depositAmount = dto.depositAmount ?? dto.deposit ?? 0;
    if (totalAmount < 0)
      throw new BadRequestException('Total cannot be negative');
    if (depositAmount < 0) {
      throw new BadRequestException('Deposit cannot be negative');
    }
    if (depositAmount > totalAmount) {
      throw new BadRequestException('Deposit cannot exceed total');
    }
    if (
      packageData?.minDeposit &&
      depositAmount > 0 &&
      depositAmount < Number(packageData.minDeposit)
    ) {
      throw new BadRequestException('Deposit is below package minimum');
    }

    return {
      areaId,
      startTime,
      endTime,
      data: {
        branchId: dto.branchId,
        areaId,
        tableId: dto.tableId,
        packageId: dto.packageId,
        orderId: dto.orderId,
        contactName: dto.contactName.trim(),
        contactPhone: dto.contactPhone.trim(),
        contactEmail: dto.contactEmail,
        partySize: dto.partySize,
        reservedAt: startTime,
        endTime,
        duration: Math.ceil((endTime.getTime() - startTime.getTime()) / 60000),
        occasion: dto.occasion,
        notes: dto.notes,
        deposit: depositAmount,
        depositAmount,
        totalAmount,
        depositPaid: depositAmount > 0,
      },
    };
  }

  private async validateReservationRules(
    normalized: {
      areaId: string | null;
      startTime: Date;
      endTime: Date;
      data: { branchId: string; partySize: number };
    },
    excludeId?: string,
  ) {
    if (normalized.data.partySize < 0) {
      throw new BadRequestException('Estimated children cannot be negative');
    }
    if (normalized.areaId) {
      const conflict = await this.hasOverlap(
        normalized.data.branchId,
        normalized.areaId,
        normalized.startTime,
        normalized.endTime,
        excludeId,
      );
      if (conflict) {
        throw new BadRequestException(
          'Reservation overlaps another active reservation in this area',
        );
      }
    }
  }

  private async validatePackage(branchId: string, packageId: string) {
    const partyPackage = await this.prisma.partyPackage.findFirst({
      where: {
        id: packageId,
        deletedAt: null,
        isActive: true,
        OR: [{ branchId: null }, { branchId }],
      },
    });
    if (!partyPackage) {
      throw new BadRequestException('Selected party package is not available');
    }
    return partyPackage;
  }

  private async resolveAreaId(
    branchId: string,
    areaId?: string,
    tableId?: string,
  ) {
    if (tableId) {
      const table = await this.prisma.restaurantTable.findFirst({
        where: {
          id: tableId,
          deletedAt: null,
          area: { branchId, deletedAt: null },
        },
        select: { areaId: true },
      });
      if (!table) {
        throw new BadRequestException('Table does not belong to this branch');
      }
      if (areaId && areaId !== table.areaId) {
        throw new BadRequestException('Table does not belong to selected area');
      }
      return table.areaId;
    }
    if (areaId) {
      await this.validateArea(branchId, areaId);
      return areaId;
    }
    return null;
  }

  private async validateArea(branchId: string, areaId: string) {
    const area = await this.prisma.tableArea.findFirst({
      where: { id: areaId, branchId, deletedAt: null },
      select: { id: true },
    });
    if (!area) throw new BadRequestException('Area does not belong to branch');
  }

  private async hasOverlap(
    branchId: string,
    areaId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ) {
    const overlap = await this.prisma.reservation.findFirst({
      where: {
        branchId,
        areaId,
        deletedAt: null,
        status: { in: blockingStatuses },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        reservedAt: { lt: endTime },
        OR: [{ endTime: { gt: startTime } }, { endTime: null }],
      },
      select: { id: true },
    });
    return Boolean(overlap);
  }

  private dayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private reservationInclude() {
    return {
      area: true,
      table: true,
      package: true,
      order: {
        select: { id: true, orderNumber: true, total: true, status: true },
      },
    } satisfies Prisma.ReservationInclude;
  }
}
