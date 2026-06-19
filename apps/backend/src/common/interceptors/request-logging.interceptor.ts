import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(context, request, startedAt, false),
        error: () => this.logRequest(context, request, startedAt, true),
      }),
    );
  }

  private logRequest(
    context: ExecutionContext,
    request: Request,
    startedAt: number,
    isError: boolean,
  ) {
    const response = context.switchToHttp().getResponse<Response>();
    const statusCode = response?.statusCode ?? (isError ? 500 : 200);
    const message = `${request.method} ${request.originalUrl ?? request.url} -> ${statusCode} ${Date.now() - startedAt}ms`;

    if (isError || statusCode >= 500) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }
}
