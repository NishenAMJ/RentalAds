import { Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchListingsQuery } from '../../common/search-area.dto';
import { RadiusThrottleGuard } from '../../common/guards/radius-throttle.guard';
import { PaginationQuery } from '../../common/pagination';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { CreateListingDto } from './create-listing.dto';
import { CreateItemListingDto } from './create-item-listing.dto';
import { CreateBlockDto, UpdateListingDto } from './update-listing.dto';
import { AdminListingsQuery } from './admin-listings.query';
import { IsString, Matches, MaxLength } from 'class-validator';
import { ListingsService } from './listings.service';
import { PublicCacheInterceptor } from '../../common/public-cache.interceptor';
import { AdminActivityService } from '../admin/admin-activity.service';

import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';

class DeleteDto {
  @IsString() @MaxLength(1000) @Matches(/\S/) reason!: string;
}

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly activity: AdminActivityService,
  ) {}
  @Post()
  @WriteThrottle(10)
  @UseGuards(AuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateListingDto,
  ) {
    return this.listings.create(user, body);
  }
  @Post('items')
  @WriteThrottle(10)
  @UseGuards(AuthGuard)
  createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateItemListingDto,
  ) {
    return this.listings.createItem(user, body);
  }
  @Get()
  @UseInterceptors(PublicCacheInterceptor)
  @UseGuards(RadiusThrottleGuard)
  browse(@Query() query: SearchListingsQuery) {
    return this.listings.browse(query);
  }
  @Get('mine')
  @UseGuards(AuthGuard)
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.listings.mine(user, query);
  }
  @Get('mine/:id')
  @UseGuards(AuthGuard)
  ownListing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.ownListing(user, id);
  }
  @Get('pending')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  pending(@Query() query: PaginationQuery) {
    return this.listings.pending(query);
  }
  @Get('admin')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  adminList(@Query() query: AdminListingsQuery) {
    return this.listings.adminList(query);
  }
  @Get('admin/lookup/:identifier')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  lookup(@Param('identifier') identifier: string) {
    return this.listings.adminLookup(identifier);
  }
  @Get(':id')
  @UseInterceptors(PublicCacheInterceptor)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.detail(id);
  }
  @Patch(':id/approve')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.listings.moderate(id, 'ACTIVE');
    await this.activity.record(
      user.authUserId,
      'LISTING_APPROVED',
      'LISTING',
      id,
      'Listing approved',
    );
    return result;
  }
  @Patch(':id/reject')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.listings.moderate(id, 'REJECTED');
    await this.activity.record(
      user.authUserId,
      'LISTING_REJECTED',
      'LISTING',
      id,
      'Listing rejected',
    );
    return result;
  }
  @Patch(':id/deactivate')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.listings.deactivate(id);
    await this.activity.record(
      user.authUserId,
      'LISTING_DEACTIVATED',
      'LISTING',
      id,
      'Listing deactivated',
    );
    return result;
  }
  @Patch(':id/reactivate')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.listings.reactivate(id);
    await this.activity.record(
      user.authUserId,
      'LISTING_REACTIVATED',
      'LISTING',
      id,
      'Listing reactivated',
    );
    return result;
  }
  @Patch(':id/reconfirm')
  @UseGuards(AuthGuard)
  reconfirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.reconfirm(user, id);
  }
  @Patch(':id/delete')
  @UseGuards(AuthGuard)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.removeMine(user, id);
  }
  @Patch(':id/admin-delete')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async adminRemove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeleteDto,
  ) {
    const result = await this.listings.removeAdmin(user, id, body.reason);
    await this.activity.record(
      user.authUserId,
      'LISTING_REMOVED',
      'LISTING',
      id,
      'Listing removed by admin',
    );
    return result;
  }
  @Patch(':id')
  @WriteThrottle(20)
  @UseGuards(AuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateListingDto,
  ) {
    return this.listings.update(user, id, body);
  }
  @Get(':id/blocks')
  @UseGuards(AuthGuard)
  blocks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.listBlocks(user, id);
  }
  @Post(':id/blocks')
  @WriteThrottle(20)
  @UseGuards(AuthGuard)
  addBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateBlockDto,
  ) {
    return this.listings.addBlock(user, id, body);
  }
  @Delete(':id/blocks/:blockId')
  @UseGuards(AuthGuard)
  removeBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return this.listings.removeBlock(user, id, blockId);
  }
}
