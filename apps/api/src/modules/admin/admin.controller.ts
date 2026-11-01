import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminService } from './admin.service';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';
import { GrantPermissionDto } from './dto/grant-permission.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}
  /** Checks permissions itself, so any admin can load the overview. */
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.summary(user.authUserId);
  }
  @Post('permissions')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManageAdmins')
  grant(@Body() dto: GrantPermissionDto) {
    return this.adminService.grantPermission(dto);
  }
}
