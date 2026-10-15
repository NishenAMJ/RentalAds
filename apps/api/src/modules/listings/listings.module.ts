import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { AvailabilityReminderService } from './availability-reminder.service';

@Module({
  imports: [UsersModule],
  controllers: [ListingsController],
  providers: [ListingsService, AvailabilityReminderService],
})
export class ListingsModule {}
