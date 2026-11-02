import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from '../../common/pagination';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { WriteThrottle } from '../../common/decorators/write-throttle.decorator';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import {
  AdminBookingsQuery,
  BookingWindowDto,
  CancelBookingDto,
  CreateBookingDto,
  RefundDoneDto,
} from './booking.dto';
import { BookingsService } from './bookings.service';
import { AdminActivityService } from '../admin/admin-activity.service';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly activity: AdminActivityService,
  ) {}

  // Static routes come before ':id' so they are not mistaken for a booking id.
  @Get('quote')
  quote(@Query() query: BookingWindowDto) {
    return this.bookings.quote(query);
  }

  @Get('availability/:listingId')
  availability(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.bookings.availability(listingId);
  }

  @Post()
  @WriteThrottle(10)
  @UseGuards(AuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBookingDto,
  ) {
    return this.bookings.create(user, body);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.bookings.mine(user, query);
  }

  @Get('received')
  @UseGuards(AuthGuard)
  received(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQuery,
  ) {
    return this.bookings.received(user, query);
  }

  @Get('admin')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  adminList(@Query() query: AdminBookingsQuery) {
    return this.bookings.adminList(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookings.get(user, id);
  }

  @Post(':id/checkout')
  @WriteThrottle(10)
  @UseGuards(AuthGuard)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookings.checkout(user, id);
  }

  @Get(':id/cancel-quote')
  @UseGuards(AuthGuard)
  cancelQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookings.cancelQuote(user, id);
  }

  @Patch(':id/cancel')
  @WriteThrottle(10)
  @UseGuards(AuthGuard)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookings.cancelByRenter(user, id);
  }

  @Patch(':id/owner-cancel')
  @WriteThrottle(10)
  @UseGuards(AuthGuard)
  ownerCancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingDto,
  ) {
    return this.bookings.cancelByOwner(user, id, body.reason);
  }

  @Patch(':id/refund-done')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async refundDone(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundDoneDto,
  ) {
    const result = await this.bookings.markRefunded(id, body.reference);
    await this.activity.record(
      user.authUserId,
      'BOOKING_REFUND_RECORDED',
      'BOOKING',
      id,
      'Booking refund recorded as sent',
    );
    return result;
  }

  @Patch(':id/admin-cancel')
  @UseGuards(AuthGuard, AdminPermissionGuard)
  @RequirePermission('canApproveListings')
  async adminCancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingDto,
  ) {
    const result = await this.bookings.adminCancel(id, body.reason);
    await this.activity.record(
      user.authUserId,
      'BOOKING_CANCELLED_BY_ADMIN',
      'BOOKING',
      id,
      'Booking cancelled by admin',
    );
    return result;
  }
}
