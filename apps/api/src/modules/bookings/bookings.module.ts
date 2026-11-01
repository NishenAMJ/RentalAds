import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PaymentsController } from './payments.controller';
import { PayhereService } from './payhere.service';

@Module({
  imports: [UsersModule],
  controllers: [BookingsController, PaymentsController],
  providers: [BookingsService, PayhereService],
  exports: [BookingsService],
})
export class BookingsModule {}
