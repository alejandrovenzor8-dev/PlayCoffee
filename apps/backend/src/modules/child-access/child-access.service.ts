import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChildAccessDto } from './dto/create-child-access.dto';
import { ChildAccessType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ChildAccessService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findActive(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.childAccess.findMany({
      where: {
        exitTime: null,
        type: ChildAccessType.ENTRY,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { entryTime: 'asc' },
    });
  }

  async findAll(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.prisma.childAccess.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async register(
    dto: CreateChildAccessDto & { branchId: string },
    userId?: string,
  ) {
    const record = await this.prisma.childAccess.create({ data: dto });

    await this.audit.record({
      branchId: record.branchId,
      userId,
      action: 'CHILD_CHECKIN',
      entity: 'ChildAccess',
      entityId: record.id,
      metadata: {
        childName: record.childName,
        guardianName: record.guardianName,
      },
    });

    return record;
  }

  async checkout(id: string, branchId?: string, userId?: string) {
    const record = await this.prisma.childAccess.findFirst({
      where: {
        id,
        ...(branchId ? { branchId } : {}),
      },
    });
    if (!record) throw new NotFoundException('Child access record not found');
    const updatedRecord = await this.prisma.childAccess.update({
      where: { id },
      data: { exitTime: new Date(), type: ChildAccessType.EXIT },
    });

    await this.audit.record({
      branchId: updatedRecord.branchId,
      userId,
      action: 'CHILD_CHECKOUT',
      entity: 'ChildAccess',
      entityId: updatedRecord.id,
      metadata: {
        childName: updatedRecord.childName,
        guardianName: updatedRecord.guardianName,
      },
    });

    return updatedRecord;
  }

  async getOverstaying(branchId?: string) {
    const now = new Date();
    const records = await this.findActive(branchId);
    return records.filter((r) => {
      if (!r.maxDuration) return false;
      const elapsed = (now.getTime() - r.entryTime.getTime()) / 60000;
      return elapsed > r.maxDuration;
    });
  }
}
