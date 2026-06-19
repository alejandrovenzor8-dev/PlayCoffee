import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEvent {
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent) {
    try {
      await this.prisma.auditLog.create({
        data: {
          branchId: event.branchId ?? null,
          userId: event.userId ?? null,
          action: event.action,
          entity: event.entity,
          entityId: event.entityId ?? null,
          metadata: event.metadata,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit log write failed: ${message}`);
    }
  }
}
