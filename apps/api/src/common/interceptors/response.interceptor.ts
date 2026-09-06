import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { Request } from 'express';
import { RESPONSE_MESSAGE_KEY } from '@/common/decorators/response-message.decorator';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  path: string;
}

/**
 * Global success envelope. Wraps every handler result as
 * `{ success, data, [message], timestamp, path }`.
 *
 * - Message comes from `@ResponseMessage(...)` and is optional.
 * - Thrown errors skip `map` and are shaped by AllExceptionsFilter instead.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const message = this.reflector.getAllAndOverride<string | undefined>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data: unknown): ApiResponse<unknown> => ({
        success: true,
        data,
        ...(message !== undefined ? { message } : {}),
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
