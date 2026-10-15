import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedUser } from './auth.guard';

@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (request.headers.authorization === undefined) {
      delete request.user;
      return true;
    }
    // Tokens that are supplied must be verified, not decoded or silently ignored.
    return super.canActivate(context);
  }
}
