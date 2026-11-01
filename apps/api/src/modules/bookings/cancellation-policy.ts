import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { daysBetween } from './booking-rules';

/**
 * How much a renter gets back when they cancel a paid booking, by how far ahead they cancel.
 * Defaults can be changed with CANCEL_FULL_REFUND_DAYS, CANCEL_PARTIAL_REFUND_DAYS and CANCEL_PARTIAL_REFUND_PERCENT.
 * Whatever is set here must also be what the Terms page says.
 */
export interface CancellationPolicy {
  /** Cancel at least this many days before the start for everything back. */
  fullRefundDays: number;
  /** Cancel at least this many days before the start for the deposit and part of the rental back. */
  partialRefundDays: number;
  /** Share of the rental returned in the partial window. The service fee is not returned. */
  partialRefundPercent: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  fullRefundDays: 7,
  partialRefundDays: 2,
  partialRefundPercent: 50,
};

export type RefundRule = 'FULL' | 'PARTIAL' | 'DEPOSIT_ONLY';

export interface RefundQuote {
  rule: RefundRule;
  refundAmount: number;
  daysBeforeStart: number;
}

function number(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  return value !== undefined &&
    value !== '' &&
    Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= max
    ? parsed
    : fallback;
}

export function cancellationPolicy(config: ConfigService): CancellationPolicy {
  const fullRefundDays = number(
    config.get<string>('CANCEL_FULL_REFUND_DAYS'),
    DEFAULT_CANCELLATION_POLICY.fullRefundDays,
    1,
    365,
  );
  return {
    fullRefundDays,
    // The partial window can never be longer than the full one.
    partialRefundDays: Math.min(
      number(
        config.get<string>('CANCEL_PARTIAL_REFUND_DAYS'),
        DEFAULT_CANCELLATION_POLICY.partialRefundDays,
        0,
        365,
      ),
      fullRefundDays,
    ),
    partialRefundPercent: number(
      config.get<string>('CANCEL_PARTIAL_REFUND_PERCENT'),
      DEFAULT_CANCELLATION_POLICY.partialRefundPercent,
      0,
      100,
    ),
  };
}

/** What the renter would get back if they cancelled today. A rental that has already started cannot be cancelled. */
export function renterRefund(
  booking: {
    rentalTotal: number;
    depositAmount: number;
    totalAmount: number;
    startDate: Date;
  },
  today: Date,
  policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY,
): RefundQuote {
  const daysBeforeStart = daysBetween(today, booking.startDate);
  if (daysBeforeStart < 0)
    throw new BadRequestException(
      'This rental has already started. Please contact the owner or our team.',
    );
  if (daysBeforeStart >= policy.fullRefundDays)
    return { rule: 'FULL', refundAmount: booking.totalAmount, daysBeforeStart };
  if (daysBeforeStart >= policy.partialRefundDays)
    return {
      rule: 'PARTIAL',
      refundAmount:
        booking.depositAmount +
        Math.round((booking.rentalTotal * policy.partialRefundPercent) / 100),
      daysBeforeStart,
    };
  return {
    rule: 'DEPOSIT_ONLY',
    refundAmount: booking.depositAmount,
    daysBeforeStart,
  };
}
