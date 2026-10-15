import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AdminPermissionName } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from './auth.guard';
export { RequirePermission } from '../decorators/require-permission.decorator';

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminPermissionName>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      dbUser?: Prisma.UserGetPayload<{ include: { adminPermission: true } }>;
    }>();
    const user = request.user;
    if (!user || !required)
      throw new ForbiddenException('Admin permission required');

    const dbUser = await this.prisma.user.findUnique({
      where: { authUserId: user.authUserId },
      include: { adminPermission: true },
    });

    if (!dbUser?.adminPermission?.[required]) {
      throw new ForbiddenException(`${required} permission required`);
    }

    request.dbUser = dbUser;
    return true;
  }
}
