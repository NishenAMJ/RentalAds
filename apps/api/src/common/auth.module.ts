import { Global, Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { AuthGuard } from './guards/auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';
import { AdminPermissionGuard } from './guards/admin-permission.guard';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuthGuard, OptionalAuthGuard, AdminPermissionGuard],
  exports: [AuthGuard, OptionalAuthGuard, AdminPermissionGuard],
})
export class AuthModule {}
