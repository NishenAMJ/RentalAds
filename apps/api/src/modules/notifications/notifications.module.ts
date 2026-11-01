import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { MailerService } from './mailer.service';
import { NotificationsController } from './notifications.controller';
import { NotifyService } from './notify.service';

/** Global so any feature can tell people about what happened without importing this module. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [MailerService, NotifyService],
  exports: [NotifyService, MailerService],
})
export class NotificationsModule {}
