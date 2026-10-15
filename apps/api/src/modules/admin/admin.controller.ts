import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminService } from './admin.service';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';
import { GrantPermissionDto } from './dto/grant-permission.dto';

@Controller('admin')
@UseGuards(AuthGuard, AdminPermissionGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}
  @Post('permissions')
  @WriteThrottle(10)
  @RequirePermission('canManageAdmins')
  grant(@Body() dto: GrantPermissionDto) {
    return this.adminService.grantPermission(dto);
  }
}
