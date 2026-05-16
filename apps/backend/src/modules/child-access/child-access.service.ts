import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChildAccessDto } from './dto/create-child-access.dto';
import { ChildAccessType } from '@prisma/client';

@Injectable()
export class ChildAccessService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.childAccess.findMany({
      where: { exitTime: null, type: ChildAccessType.ENTRY },
      orderBy: { entryTime: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.childAccess.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async register(dto: CreateChildAccessDto) {
    return this.prisma.childAccess.create({ data: dto });
  }

  async checkout(id: string) {
    const record = await this.prisma.childAccess.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Child access record not found');
    return this.prisma.childAccess.update({
      where: { id },
      data: { exitTime: new Date(), type: ChildAccessType.EXIT },
    });
  }

  async getOverstaying() {
    const now = new Date();
    const records = await this.findActive();
    return records.filter((r) => {
      if (!r.maxDuration) return false;
      const elapsed = (now.getTime() - r.entryTime.getTime()) / 60000;
      return elapsed > r.maxDuration;
    });
  }
}
