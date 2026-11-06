import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type CancelledBy, type Listing } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import {
  pageResult,
  pageWindow,
  type PaginationQuery,
} from '../../common/pagination';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { UsersService } from '../users/users.service';
import { NotifyService } from '../notifications/notify.service';
import { publicVisibility } from '../listings/availability';
import { isItemCategory } from '../categories/category-registry';
import type {
  AdminBookingsQuery,
  BookingWindowDto,
  CreateBookingDto,
} from './booking.dto';
import {
  DEFAULT_SERVICE_FEE_PERCENT,
  PAYMENT_WINDOW_MINUTES,
  formatCalendarDate,
  parseCalendarDate,
  priceBooking,
  todayInSriLanka,
  validateWindow,
} from './booking-rules';
import { holdingDates, overlapping } from './booking-holds';
import { cancellationPolicy, renterRefund } from './cancellation-policy';
import { toBookingView } from './booking-view';
import { PayhereService, type PayhereNotification } from './payhere.service';

type Db = Pick<PrismaService, 'booking' | 'listingBlock'>;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly payhere: PayhereService,
    private readonly notify: NotifyService,
  ) {}

  private serviceFeePercent() {
    const value = Number(
      this.config.get<string>('BOOKING_SERVICE_FEE_PERCENT'),
    );
    return Number.isFinite(value) && value >= 0 && value <= 50
      ? value
      : DEFAULT_SERVICE_FEE_PERCENT;
  }

  /** A listing that can be booked right now: live, recently confirmed by its owner, and an item category. */
  private async bookableListing(
    listingId: string,
    now: Date,
  ): Promise<Listing> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, ...publicVisibility(this.config, now) },
    });
    if (!listing || !isItemCategory(listing.category))
      throw new NotFoundException('This item is not available to book');
    return listing;
  }

  private quoteFor(listing: Listing, window: BookingWindowDto, now: Date) {
    const start = parseCalendarDate(window.startDate);
    const end = parseCalendarDate(window.endDate);
    const days = validateWindow(start, end, todayInSriLanka(now));
    return {
      start,
      end,
      days,
      price: priceBooking({
        ratePeriod: listing.ratePeriod,
        rate: listing.monthlyRent,
        days,
        depositAmount: listing.depositAmount ?? 0,
        serviceFeePercent: this.serviceFeePercent(),
      }),
    };
  }

  /** Price for a date range, so the web shows exactly what the booking will cost. */
  async quote(window: BookingWindowDto) {
    const now = new Date();
    const listing = await this.bookableListing(window.listingId, now);
    const { start, end, days, price } = this.quoteFor(listing, window, now);
    await this.assertFree(this.prisma, listing.id, start, end, now);
    return {
      days,
      ratePeriod: listing.ratePeriod,
      rateAmount: listing.monthlyRent,
      ...price,
    };
  }

  /** Date ranges that cannot be booked, whether taken by a renter or blocked by the owner. Nothing about who. */
  async availability(listingId: string) {
    const now = new Date();
    const today = todayInSriLanka(now);
    const [bookings, blocks] = await Promise.all([
      this.prisma.booking.findMany({
        where: { listingId, endDate: { gt: today }, ...holdingDates(now) },
        select: { startDate: true, endDate: true },
      }),
      this.prisma.listingBlock.findMany({
        where: { listingId, endDate: { gt: today } },
        select: { startDate: true, endDate: true },
      }),
    ]);
    return [...bookings, ...blocks]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((row) => ({
        startDate: formatCalendarDate(row.startDate),
        endDate: formatCalendarDate(row.endDate),
      }));
  }

  private async assertFree(
    db: Db,
    listingId: string,
    start: Date,
    end: Date,
    now: Date,
    ignoreBookingId?: string,
  ) {
    const [clash, blocked] = await Promise.all([
      db.booking.findFirst({
        where: {
          listingId,
          ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
          ...overlapping(start, end),
          ...holdingDates(now),
        },
        select: { id: true },
      }),
      db.listingBlock.findFirst({
        where: { listingId, ...overlapping(start, end) },
        select: { id: true },
      }),
    ]);
    if (clash || blocked)
      throw new ConflictException('Those dates are not available');
  }

  async create(authUser: AuthenticatedUser, input: CreateBookingDto) {
    const now = new Date();
    const renter = await this.users.findOrCreate(authUser);
    const listing = await this.bookableListing(input.listingId, now);
    if (listing.ownerId === renter.id)
      throw new ForbiddenException('You cannot book your own item');
    const { start, end, price } = this.quoteFor(listing, input, now);
    const booking = await this.prisma.$transaction(async (tx) => {
      // Two renters picking the same dates at once must queue up behind this lock.
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listing.id} FOR UPDATE`;
      await this.assertFree(tx, listing.id, start, end, now);
      return tx.booking.create({
        data: {
          listingId: listing.id,
          renterId: renter.id,
          startDate: start,
          endDate: end,
          units: price.units,
          rateAmount: listing.monthlyRent,
          rentalTotal: price.rentalTotal,
          serviceFee: price.serviceFee,
          depositAmount: price.depositAmount,
          totalAmount: price.totalAmount,
          renterContact: input.renterContact,
          expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60_000),
        },
        include: { listing: true },
      });
    });
    return toBookingView(booking, 'renter', now);
  }

  async mine(authUser: AuthenticatedUser, query: PaginationQuery) {
    const renter = await this.users.findOrCreate(authUser);
    const rows = await this.prisma.booking.findMany({
      where: { renterId: renter.id },
      include: { listing: true, review: { select: { rating: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    const now = new Date();
    return pageResult(
      rows.map((row) => toBookingView(row, 'renter', now)),
      query,
    );
  }

  /** Paid bookings of the caller's own items. Unpaid attempts are not shown to owners. */
  async received(authUser: AuthenticatedUser, query: PaginationQuery) {
    const owner = await this.users.findOrCreate(authUser);
    const rows = await this.prisma.booking.findMany({
      where: { listing: { ownerId: owner.id }, paidAt: { not: null } },
      include: { listing: true },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    const now = new Date();
    return pageResult(
      rows.map((row) => toBookingView(row, 'owner', now)),
      query,
    );
  }

  private async ownBooking(authUser: AuthenticatedUser, id: string) {
    const renter = await this.users.findOrCreate(authUser);
    const booking = await this.prisma.booking.findFirst({
      where: { id, renterId: renter.id },
      include: { listing: true, review: { select: { rating: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return { booking, renter };
  }

  async review(authUser: AuthenticatedUser, id: string, rating: number) {
    const { booking, renter } = await this.ownBooking(authUser, id);
    const today = todayInSriLanka();
    if (
      booking.paidAt === null ||
      booking.status !== 'CONFIRMED' ||
      booking.endDate > today
    )
      throw new ConflictException(
        'Only a completed, paid booking can be rated',
      );
    if (booking.review)
      throw new ConflictException('You have already rated this booking');
    try {
      const review = await this.prisma.bookingReview.create({
        data: {
          bookingId: booking.id,
          listingId: booking.listingId,
          reviewerId: renter.id,
          rating,
        },
        select: { rating: true, createdAt: true },
      });
      return review;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('You have already rated this booking');
      throw error;
    }
  }

  async get(authUser: AuthenticatedUser, id: string) {
    const { booking } = await this.ownBooking(authUser, id);
    return toBookingView(booking, 'renter');
  }

  /** The form the browser posts to PayHere. Only the renter can start payment, and only while the dates are held. */
  async checkout(authUser: AuthenticatedUser, id: string) {
    const { booking, renter } = await this.ownBooking(authUser, id);
    const now = new Date();
    if (booking.status !== 'PENDING_PAYMENT')
      throw new ConflictException('This booking is not waiting for payment');
    if (!booking.expiresAt || booking.expiresAt <= now)
      throw new ConflictException('This booking expired. Please book again.');
    return this.payhere.checkout(
      booking,
      { email: renter.email, phone: booking.renterContact },
      booking.listing.title ?? booking.listing.areaText,
    );
  }

  /** What the renter would get back if they cancelled right now, shown before they confirm. */
  async cancelQuote(authUser: AuthenticatedUser, id: string) {
    const { booking } = await this.ownBooking(authUser, id);
    if (booking.status === 'PENDING_PAYMENT')
      return { rule: 'UNPAID' as const, refundAmount: 0, daysBeforeStart: 0 };
    if (booking.status !== 'CONFIRMED')
      throw new ConflictException('This booking cannot be cancelled');
    return renterRefund(
      booking,
      todayInSriLanka(),
      cancellationPolicy(this.config),
    );
  }

  /**
   * A renter cancels. Unpaid bookings just free their dates. Paid ones follow the cancellation policy, and what is
   * owed back is recorded for the team to refund in PayHere.
   */
  async cancelByRenter(authUser: AuthenticatedUser, id: string) {
    const { booking } = await this.ownBooking(authUser, id);
    const now = new Date();
    if (booking.status === 'PENDING_PAYMENT') {
      const result = await this.prisma.booking.updateMany({
        where: { id: booking.id, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledBy: 'RENTER',
        },
      });
      if (!result.count)
        throw new ConflictException('This booking can no longer be cancelled');
      return { id, status: 'CANCELLED' as const, refundAmount: 0 };
    }
    if (booking.status !== 'CONFIRMED')
      throw new ConflictException('This booking cannot be cancelled');
    const quote = renterRefund(
      booking,
      todayInSriLanka(now),
      cancellationPolicy(this.config),
    );
    await this.cancelPaid(booking.id, {
      by: 'RENTER',
      reason: 'Cancelled by the renter',
      refundAmount: quote.refundAmount,
      now,
    });
    await this.notify.send([
      {
        userId: booking.listing.ownerId,
        type: 'BOOKING_CANCELLED',
        title: 'A booking was cancelled',
        message: `${this.nameOf(booking.listing)} (${this.datesOf(booking)}) was cancelled by the renter. The dates are free again.`,
        link: '/owner/bookings',
      },
      {
        userId: booking.renterId,
        type: 'BOOKING_CANCELLED',
        title: 'Your booking is cancelled',
        message:
          quote.refundAmount > 0
            ? `${this.nameOf(booking.listing)} is cancelled. We will refund LKR ${quote.refundAmount.toLocaleString('en-LK')} to your payment method and email you when it is sent.`
            : `${this.nameOf(booking.listing)} is cancelled. Under the cancellation policy no refund is due.`,
        link: '/bookings',
      },
    ]);
    return {
      id,
      status: 'CANCELLED' as const,
      refundAmount: quote.refundAmount,
    };
  }

  /** The owner cannot honour a paid booking: the renter gets everything back and is told why. */
  async cancelByOwner(authUser: AuthenticatedUser, id: string, reason: string) {
    const owner = await this.users.findOrCreate(authUser);
    const booking = await this.prisma.booking.findFirst({
      where: { id, listing: { ownerId: owner.id } },
      include: { listing: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'CONFIRMED')
      throw new ConflictException('Only paid bookings can be cancelled');
    if (booking.endDate <= todayInSriLanka())
      throw new ConflictException('This rental has already finished');
    const now = new Date();
    await this.cancelPaid(booking.id, {
      by: 'OWNER',
      reason,
      refundAmount: booking.totalAmount,
      now,
    });
    await this.notify.send([
      {
        userId: booking.renterId,
        type: 'BOOKING_CANCELLED',
        title: 'The owner cancelled your booking',
        message: `${this.nameOf(booking.listing)} (${this.datesOf(booking)}) was cancelled by the owner. Reason: ${reason.trim()}. We will refund the full LKR ${booking.totalAmount.toLocaleString('en-LK')} and email you when it is sent.`,
        link: '/bookings',
      },
    ]);
    return {
      id,
      status: 'CANCELLED' as const,
      refundAmount: booking.totalAmount,
    };
  }

  /** Marks a paid booking cancelled and records the refund owed. A booking can only be cancelled once. */
  private async cancelPaid(
    id: string,
    detail: {
      by: CancelledBy;
      reason: string;
      refundAmount: number;
      now: Date;
    },
  ) {
    const result = await this.prisma.booking.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: {
        status: 'CANCELLED',
        cancelledAt: detail.now,
        cancelledBy: detail.by,
        cancelReason: detail.reason.trim(),
        refundAmount: detail.refundAmount,
        refundStatus: detail.refundAmount > 0 ? 'DUE' : 'NONE',
      },
    });
    if (!result.count)
      throw new ConflictException('This booking can no longer be cancelled');
  }

  private nameOf(listing: Listing) {
    return listing.title ?? listing.areaText;
  }

  private datesOf(booking: { startDate: Date; endDate: Date }) {
    return `${formatCalendarDate(booking.startDate)} to ${formatCalendarDate(booking.endDate)}`;
  }

  /**
   * Handles PayHere's server-to-server notification. Nothing in the body is trusted until its signature
   * matches; the amount must also equal what we charged. Safe to receive more than once.
   */
  async handlePayhereNotification(body: PayhereNotification): Promise<void> {
    if (!this.payhere.verify(body))
      throw new ForbiddenException('Invalid signature');
    const booking = await this.prisma.booking.findUnique({
      where: { id: body.order_id },
      include: { listing: true },
    });
    if (!booking) return;
    if (
      body.payhere_currency !== 'LKR' ||
      body.payhere_amount !== booking.totalAmount.toFixed(2)
    ) {
      this.logger.warn(`PayHere amount mismatch for booking ${booking.id}`);
      return;
    }
    if (body.status_code !== '2') return;

    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${booking.listingId} FOR UPDATE`;

      // Read after acquiring the listing lock: concurrent PayHere retries may
      // have loaded the same unpaid booking before either transaction started.
      const current = await tx.booking.findUnique({
        where: { id: booking.id },
        select: { status: true, paidAt: true },
      });
      if (!current || current.paidAt) return 'ALREADY_PROCESSED' as const;

      let canConfirm = current.status === 'PENDING_PAYMENT';
      if (canConfirm) {
        try {
          await this.assertFree(
            tx,
            booking.listingId,
            booking.startDate,
            booking.endDate,
            now,
            booking.id,
          );
        } catch {
          canConfirm = false;
        }
      }
      const claimed = await tx.booking.updateMany({
        where: { id: booking.id, paidAt: null },
        data: {
          paidAt: now,
          paymentReference: body.payment_id ?? null,
          status: canConfirm ? 'CONFIRMED' : 'CANCELLED',
          ...(canConfirm
            ? {}
            : {
                cancelledAt: now,
                cancelledBy: 'SYSTEM' as const,
                cancelReason: 'The dates were no longer available',
                refundAmount: booking.totalAmount,
                refundStatus: 'DUE' as const,
              }),
        },
      });
      if (!claimed.count) return 'ALREADY_PROCESSED' as const;
      return canConfirm ? 'CONFIRMED' as const : 'REFUND_DUE' as const;
    });

    if (outcome === 'ALREADY_PROCESSED') return;
    if (outcome === 'REFUND_DUE') {
      // Paid after the window closed and the dates were taken: the money is owed back in full.
      this.logger.warn(
        `Booking ${booking.id} was paid but could not be confirmed; refund due`,
      );
      await this.notify.send([
        {
          userId: booking.renterId,
          type: 'BOOKING_CANCELLED',
          title: 'We could not confirm your booking',
          message: `Your payment for ${this.nameOf(booking.listing)} arrived after the dates were taken. We will refund the full LKR ${booking.totalAmount.toLocaleString('en-LK')} and email you when it is sent.`,
          link: '/bookings',
        },
      ]);
      return;
    }
    await this.notify.send([
      {
        userId: booking.renterId,
        type: 'BOOKING_CONFIRMED',
        title: 'Your booking is confirmed',
        message: `${this.nameOf(booking.listing)}: ${this.datesOf(booking)}. The owner's contact number is now on your bookings page.`,
        link: '/bookings',
      },
      {
        userId: booking.listing.ownerId,
        type: 'BOOKING_RECEIVED',
        title: 'New booking',
        message: `${this.nameOf(booking.listing)} is booked: ${this.datesOf(booking)}. The renter's number is on your bookings page.`,
        link: '/owner/bookings',
      },
    ]);
  }

  async adminList(query: AdminBookingsQuery) {
    const rows = await this.prisma.booking.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.refund ? { refundStatus: 'DUE' as const } : {}),
      },
      include: { listing: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    const now = new Date();
    return pageResult(
      rows.map((row) => toBookingView(row, 'admin', now)),
      query,
    );
  }

  /** Cancels a booking on both parties' behalf. A paid booking is refunded in full. */
  async adminCancel(id: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED')
      throw new ConflictException('This booking is already cancelled');
    if (!reason.trim()) throw new BadRequestException('A reason is required');
    const now = new Date();
    const refund = booking.paidAt ? booking.totalAmount : 0;
    await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: 'ADMIN',
        cancelReason: reason.trim(),
        refundAmount: refund,
        refundStatus: refund > 0 ? 'DUE' : 'NONE',
      },
    });
    const base = `${this.nameOf(booking.listing)} (${this.datesOf(booking)}) was cancelled by our team. Reason: ${reason.trim()}.`;
    await this.notify.send([
      {
        userId: booking.renterId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        message: refund
          ? `${base} We will refund the full LKR ${refund.toLocaleString('en-LK')} and email you when it is sent.`
          : base,
        link: '/bookings',
      },
      {
        userId: booking.listing.ownerId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        message: base,
        link: '/owner/bookings',
      },
    ]);
    return { id, status: 'CANCELLED' as const, refundAmount: refund };
  }

  /** The team has sent the refund in PayHere; record it and tell the renter. */
  async markRefunded(id: string, reference?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const result = await this.prisma.booking.updateMany({
      where: { id, refundStatus: 'DUE' },
      data: {
        refundStatus: 'DONE',
        refundedAt: new Date(),
        refundReference: reference?.trim() || null,
      },
    });
    if (!result.count)
      throw new ConflictException('No refund is due for this booking');
    await this.notify.send([
      {
        userId: booking.renterId,
        type: 'BOOKING_CANCELLED',
        title: 'Your refund has been sent',
        message: `We refunded LKR ${booking.refundAmount.toLocaleString('en-LK')} for ${this.nameOf(booking.listing)}. It can take a few days to appear.`,
        link: '/bookings',
      },
    ]);
    return { id, refundStatus: 'DONE' as const };
  }

  /** Counts for the admin overview. */
  async counts() {
    const now = new Date();
    const [upcoming, refundDue] = await Promise.all([
      this.prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          endDate: { gt: todayInSriLanka(now) },
        },
      }),
      this.prisma.booking.count({ where: { refundStatus: 'DUE' } }),
    ]);
    return { upcoming, refundDue };
  }
}
