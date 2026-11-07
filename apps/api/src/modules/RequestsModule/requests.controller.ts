import { Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from '../../common/pagination';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequestsService } from './requests.service';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';
import { CreateRequestDto } from './create-request.dto';
import { AdminRequestQuery, UpdateRequestWorkDto } from './request-work.dto';
import { IsString, Matches, MaxLength } from 'class-validator';
class DeleteDto {
  @IsString() @MaxLength(1000) @Matches(/\S/) reason!: string;
}
import { PrismaService } from '../../common/prisma.service';
import { AdminActivityService } from '../admin/admin-activity.service';

@ApiTags('requests')
@Controller('requests')
@UseGuards(AuthGuard)
export class RequestsController {
  constructor(
    private requestsService: RequestsService,
    private prisma: PrismaService,
    private activity: AdminActivityService,
  ) {}

  @Post()
  @WriteThrottle(10)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRequestDto,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { authUserId: user.authUserId },
    });
    if (!dbUser) throw new ForbiddenException('User not provisioned');
    return this.requestsService.create(dbUser.id, dto);
  }

  @Get('mine')
  async mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { authUserId: user.authUserId },
    });
    if (!dbUser) throw new ForbiddenException('User not provisioned');
    return this.requestsService.findMine(dbUser.id, query);
  }

  @Get()
  @UseGuards(AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async all(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminRequestQuery,
  ) {
    return this.requestsService.findAllForAdmin(query, user.authUserId);
  }

  @Patch(':id/work')
  @UseGuards(AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async work(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRequestWorkDto,
  ) {
    const result = await this.requestsService.updateWork(
      user.authUserId,
      id,
      body,
    );
    await this.activity.record(
      user.authUserId,
      'REQUEST_WORK_UPDATED',
      'REQUEST',
      id,
      'Rental request queue details updated',
    );
    return result;
  }

  @Patch(':id/close')
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { authUserId: user.authUserId },
    });
    if (!dbUser) throw new ForbiddenException('User not provisioned');
    return this.requestsService.close(dbUser.id, id);
  }
  @Patch(':id/delete') async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const db = await this.prisma.user.findUnique({
      where: { authUserId: user.authUserId },
    });
    if (!db) throw new ForbiddenException('User not provisioned');
    return this.requestsService.remove(id, db.id);
  }
  @Patch(':id/admin-delete')
  @UseGuards(AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async adminRemove(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeleteDto,
  ) {
    const result = await this.requestsService.removeAdmin(
      u.authUserId,
      id,
      body.reason,
    );
    await this.activity.record(
      u.authUserId,
      'REQUEST_REMOVED',
      'REQUEST',
      id,
      'Rental request removed by admin',
    );
    return result;
  }
}
