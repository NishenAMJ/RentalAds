import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminService } from './admin.service';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { OwnerPayoutsService } from './owner-payouts.service';
import {
  CreateOwnerPayoutDto,
  RecordOwnerPayoutDto,
} from './dto/owner-payout.dto';
import { AdminActivityService } from './admin-activity.service';
import { PaginationQuery } from '../../common/pagination';
import { AdminUsersQuery } from './dto/admin-users.query';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private payouts: OwnerPayoutsService,
    private activity: AdminActivityService,
  ) {}
  /** Checks permissions itself, so any admin can load the overview. */
  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.summary(user.authUserId);
  }
  @Get('activity')
  activityList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.activity.list(user.authUserId, query);
  }
  @Get('users')
  @UseGuards(AdminPermissionGuard)
  @RequirePermission('canManageAdmins')
  usersList(@Query() query: AdminUsersQuery) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManageAdmins')
  updateUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(user.authUserId, id, dto);
  }
  @Post('permissions')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManageAdmins')
  grant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GrantPermissionDto,
  ) {
    return this.adminService.grantPermission(user.authUserId, dto);
  }

  @Get('payouts')
  @UseGuards(AdminPermissionGuard)
  @RequirePermission('canManagePayouts')
  payoutsList(@Query('status') status?: string) {
    return this.payouts.list(status);
  }

  @Post('payouts')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManagePayouts')
  createPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOwnerPayoutDto,
  ) {
    return this.payouts.create(user.authUserId, dto);
  }

  @Patch('payouts/:id/paid')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManagePayouts')
  markPayoutPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordOwnerPayoutDto,
  ) {
    return this.payouts.markPaid(user.authUserId, id, dto);
  }
}
