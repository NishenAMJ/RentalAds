import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  PaginationQuery,
  pageResult,
  pageWindow,
} from '../../common/pagination';

@Injectable()
export class AdminActivityService {
  private readonly logger = new Logger(AdminActivityService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(
    authUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!actor) {
      this.logger.error(`Unable to record ${action}: admin account not found`);
      return;
    }
    try {
      await this.prisma.adminActivity.create({
        data: { actorId: actor.id, action, entityType, entityId, summary },
      });
    } catch (error) {
      this.logger.error(
        `Unable to record admin action ${action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async list(authUserId: string, query: PaginationQuery) {
    const admin = await this.prisma.user.findUnique({
      where: { authUserId },
      include: { adminPermission: true },
    });
    const permissions = admin?.adminPermission;
    if (
      !permissions ||
      !Object.values(permissions).some((value) => value === true)
    )
      throw new ForbiddenException('Admin permission required');
    const rows = await this.prisma.adminActivity.findMany({
      include: { actor: { select: { email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }
}
