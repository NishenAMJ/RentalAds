import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Lets a route's successful response be shared by CDNs and browsers for a short time.
 * The header is set only after the handler succeeds, so errors (404, 400, 429...) keep
 * the default `no-store` and are never cached.
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  static readonly VALUE = 'public, max-age=30, stale-while-revalidate=60';

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next
      .handle()
      .pipe(
        tap(() =>
          response.setHeader('Cache-Control', PublicCacheInterceptor.VALUE),
        ),
      );
  }
}
