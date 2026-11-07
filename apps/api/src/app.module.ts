import { AuthModule } from './common/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './common/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { ListingsModule } from './modules/listings/listings.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { RequestsModule } from './modules/RequestsModule/requests.module';
import { MatchingModule } from './modules/matching/matching.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AdminActivityModule } from './modules/admin/admin-activity.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    CloudinaryModule,
    RequestsModule,
    MatchingModule,
    ComplaintsModule,
    AdminModule,
    AdminActivityModule,
    NotificationsModule,
    CategoriesModule,
    BookingsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
