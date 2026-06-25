import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

type RealtimeUser = {
  id: string;
  branchId: string;
  role: string;
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(','),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      await client.join(this.branchRoom(user.branchId));
      this.logger.log(
        `Socket ${client.id} joined ${this.branchRoom(user.branchId)}`,
      );
      client.emit('realtime.connected', {
        userId: user.id,
        branchId: user.branchId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unauthorized socket';
      this.logger.warn(`Socket ${client.id} rejected: ${message}`);
      client.emit('realtime.error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  emitToBranch(branchId: string, event: string, payload: unknown) {
    if (!branchId) return;
    this.server.to(this.branchRoom(branchId)).emit(event, payload);
  }

  emitTableUpdated(branchId: string, table: { id: string; status?: string }) {
    this.emitToBranch(branchId, 'table.updated', table);
  }

  emitTableStatusChanged(
    branchId: string,
    table: { id: string; status: string },
  ) {
    this.emitToBranch(branchId, 'table.status.changed', table);
  }

  emitOrderEvent(branchId: string, event: string, payload: unknown) {
    this.emitToBranch(branchId, event, payload);
  }

  emitPaymentEvent(branchId: string, event: string, payload: unknown) {
    this.emitToBranch(branchId, event, payload);
  }

  emitChildAccessEvent(branchId: string, event: string, payload: unknown) {
    this.emitToBranch(branchId, event, payload);
  }

  emitInventoryEvent(branchId: string, event: string, payload: unknown) {
    this.emitToBranch(branchId, event, payload);
  }

  emitReservationEvent(branchId: string, event: string, payload: unknown) {
    this.emitToBranch(branchId, event, payload);
  }

  private branchRoom(branchId: string) {
    return `branch:${branchId}`;
  }

  private async authenticate(client: Socket): Promise<RealtimeUser> {
    const rawToken =
      client.handshake.auth?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('Missing token');
    }

    const payload = await this.jwt.verifyAsync<{
      sub: string;
      branchId?: string;
      role?: string;
    }>(rawToken);
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
      select: { id: true, branchId: true, role: true },
    });
    if (!user?.branchId) {
      throw new UnauthorizedException('User has no branch');
    }
    return { id: user.id, branchId: user.branchId, role: user.role };
  }
}
