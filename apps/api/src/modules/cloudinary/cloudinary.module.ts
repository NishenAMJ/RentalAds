import { Module } from '@nestjs/common';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [CloudinaryController],
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
