import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { searchKeys } from '../search-area.dto';

@Injectable()
export class RadiusThrottleGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    return Promise.resolve(
      !searchKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(request.query, key),
      ),
    );
  }
}
