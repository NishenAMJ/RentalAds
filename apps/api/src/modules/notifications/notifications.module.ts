import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { NotificationsController } from './notifications.controller';
@Module({ imports: [PrismaModule], controllers: [NotificationsController] })
export class NotificationsModule {}
