import type { Booking, Listing } from '@prisma/client';
import { formatCalendarDate, todayInSriLanka } from './booking-rules';

type BookingWithListing = Booking & { listing: Listing };

/**
 * What to show for a booking. Two states are worked out from the clock so no background job is needed:
 * a paid rental whose period has ended is COMPLETED, and an unpaid one whose 30-minute hold has run out is EXPIRED.
 */
function displayStatus(booking: Booking, now: Date) {
  if (booking.status === 'CONFIRMED' && booking.endDate <= todayInSriLanka(now))
    return 'COMPLETED' as const;
  if (
    booking.status === 'PENDING_PAYMENT' &&
    booking.expiresAt !== null &&
    booking.expiresAt <= now
  )
    return 'EXPIRED' as const;
  return booking.status;
}

/**
 * Who may see the other party's phone number: only once the booking is paid, which is when
 * the introduction an admin makes for homes is replaced by the payment itself.
 */
export function toBookingView(
  booking: BookingWithListing,
  viewer: 'renter' | 'owner' | 'admin',
  now = new Date(),
) {
  const status = displayStatus(booking, now);
  const paid = status === 'CONFIRMED' || status === 'COMPLETED';
  return {
    id: booking.id,
    status,
    startDate: formatCalendarDate(booking.startDate),
    endDate: formatCalendarDate(booking.endDate),
    units: booking.units,
    ratePeriod: booking.listing.ratePeriod,
    rateAmount: booking.rateAmount,
    rentalTotal: booking.rentalTotal,
    serviceFee: booking.serviceFee,
    depositAmount: booking.depositAmount,
    totalAmount: booking.totalAmount,
    expiresAt: booking.expiresAt,
    paidAt: booking.paidAt,
    createdAt: booking.createdAt,
    cancelledBy: booking.cancelledBy,
    cancelReason: booking.cancelReason,
    listing: {
      id: booking.listing.id,
      reference: booking.listing.reference,
      category: booking.listing.category,
      title: booking.listing.title,
      areaText: booking.listing.areaText,
      photoUrl: booking.listing.photoUrls[0] ?? null,
    },
    // Owners are not told what the renter is owed back; renters and the team are.
    ...(viewer !== 'owner'
      ? {
          refundAmount: booking.refundAmount,
          refundStatus: booking.refundStatus,
        }
      : {}),
    ...(viewer === 'renter' && paid
      ? { ownerContact: booking.listing.ownerContact }
      : {}),
    ...(viewer === 'owner' && paid
      ? { renterContact: booking.renterContact }
      : {}),
    ...(viewer === 'admin'
      ? {
          ownerContact: booking.listing.ownerContact,
          renterContact: booking.renterContact,
          paymentReference: booking.paymentReference,
          refundDue: booking.refundStatus === 'DUE',
          refundReference: booking.refundReference,
        }
      : {}),
  };
}
