import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../common/prisma.module';
import { BookingsModule } from '../bookings/bookings.module';
import { OwnerPayoutsService } from './owner-payouts.service';

@Module({
  imports: [PrismaModule, BookingsModule],
  controllers: [AdminController],
  providers: [AdminService, OwnerPayoutsService],
})
export class AdminModule {}
