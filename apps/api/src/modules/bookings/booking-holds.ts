import type { Prisma } from '@prisma/client';

/** Bookings that currently hold their dates: paid, or unpaid but still inside the payment window. */
export const holdingDates = (now: Date): Prisma.BookingWhereInput => ({
  OR: [
    { status: 'CONFIRMED' },
    { status: 'PENDING_PAYMENT', expiresAt: { gt: now } },
  ],
});

/** Anything overlapping [start, end): the same half-open convention bookings and blocks use. */
export const overlapping = (start: Date, end: Date) => ({
  startDate: { lt: end },
  endDate: { gt: start },
});
