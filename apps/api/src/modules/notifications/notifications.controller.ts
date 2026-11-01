import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  type AuthenticatedUser,
} from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  private async user(authUserId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { authUserId } });
  }

  @Get()
  async list(@CurrentUser() authenticatedUser: AuthenticatedUser) {
    const user = await this.user(authenticatedUser.authUserId);

    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('unread-count')
  async count(@CurrentUser() authenticatedUser: AuthenticatedUser) {
    const user = await this.user(authenticatedUser.authUserId);

    return {
      count: await this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    };
  }

  @Patch('read-all')
  async all(@CurrentUser() authenticatedUser: AuthenticatedUser) {
    const user = await this.user(authenticatedUser.authUserId);

    return this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  @Patch(':id/read')
  async read(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = await this.user(authenticatedUser.authUserId);

    return this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
