import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AdminActivityService } from './admin-activity.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AdminActivityService],
  exports: [AdminActivityService],
})
export class AdminActivityModule {}
