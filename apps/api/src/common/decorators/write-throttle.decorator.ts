import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

/**
 * Per-client rate limit for routes that create or change data.
 * Defaults to 10 requests per minute.
 */
export function WriteThrottle(limit = 10, ttlMs = 60_000) {
  return applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({ default: { limit, ttl: ttlMs } }),
  );
}
