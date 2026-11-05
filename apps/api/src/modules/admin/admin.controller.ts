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
import { PropertyCommissionsService } from './property-commissions.service';
import {
  CreatePropertyCommissionDto,
  PropertyCommissionQueryDto,
  UpdatePropertyCommissionDto,
} from './dto/property-commission.dto';
import { PaginationQuery } from '../../common/pagination';
import { AdminUsersQuery } from './dto/admin-users.query';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateOwnerVerificationDto } from './dto/update-owner-verification.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private payouts: OwnerPayoutsService,
    private commissions: PropertyCommissionsService,
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

  @Patch('users/:id/verification')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManageAdmins')
  updateOwnerVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnerVerificationDto,
  ) {
    return this.adminService.updateOwnerVerification(user.authUserId, id, dto);
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

  @Get('commissions')
  @UseGuards(AdminPermissionGuard)
  @RequirePermission('canManageCommissions')
  commissionsList(@Query() query: PropertyCommissionQueryDto) {
    return this.commissions.list(query);
  }

  @Get('commissions/mine')
  myCommissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.commissions.listForOwner(user.authUserId, query);
  }

  @Post('commissions')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManageCommissions')
  createCommission(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePropertyCommissionDto,
  ) {
    return this.commissions.create(user.authUserId, dto);
  }

  @Patch('commissions/:id')
  @UseGuards(AdminPermissionGuard)
  @WriteThrottle(10)
  @RequirePermission('canManageCommissions')
  updateCommission(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyCommissionDto,
  ) {
    return this.commissions.update(user.authUserId, id, dto);
  }
}
