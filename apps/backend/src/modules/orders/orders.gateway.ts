import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBranch')
  handleJoinBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`branch:${branchId}`);
    this.logger.log(`Client ${client.id} joined branch:${branchId}`);
  }

  @SubscribeMessage('leaveBranch')
  handleLeaveBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`branch:${branchId}`);
  }

  emitOrderCreated(branchId: string, order: unknown) {
    this.server.to(`branch:${branchId}`).emit('orderCreated', order);
  }

  emitOrderUpdated(branchId: string, order: unknown) {
    this.server.to(`branch:${branchId}`).emit('orderUpdated', order);
  }

  emitTableStatusChanged(branchId: string, table: unknown) {
    this.server.to(`branch:${branchId}`).emit('tableStatusChanged', table);
  }
}
