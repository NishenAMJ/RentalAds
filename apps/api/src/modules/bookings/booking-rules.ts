import { BadRequestException } from '@nestjs/common';
import type { RatePeriod } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest single booking, so a typo cannot lock an item for years. */
export const MAX_BOOKING_DAYS = 90;
/** How long an unpaid booking holds its dates. */
export const PAYMENT_WINDOW_MINUTES = 30;
export const DEFAULT_SERVICE_FEE_PERCENT = 10;

/** Parses a calendar date such as 2026-11-05 into midnight UTC, rejecting anything else (including 2026-02-31). */
export function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match
    ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]))
    : null;
  if (!date || date.toISOString().slice(0, 10) !== value)
    throw new BadRequestException(
      'Dates must be real calendar dates in YYYY-MM-DD format',
    );
  return date;
}

export const formatCalendarDate = (date: Date) =>
  date.toISOString().slice(0, 10);

/** Today's date in Sri Lanka, as midnight UTC, so "today" does not flip at 5:30 am local time. */
export function todayInSriLanka(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
  }).format(now);
  return parseCalendarDate(parts);
}

export function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/** Checks a requested booking window and returns its length in days. */
export function validateWindow(start: Date, end: Date, today: Date): number {
  if (start < today)
    throw new BadRequestException('The start date cannot be in the past');
  const days = daysBetween(start, end);
  if (days < 1)
    throw new BadRequestException('The end date must be after the start date');
  if (days > MAX_BOOKING_DAYS)
    throw new BadRequestException(
      `A booking can be at most ${MAX_BOOKING_DAYS} days`,
    );
  return days;
}

export interface BookingPrice {
  units: number;
  rentalTotal: number;
  serviceFee: number;
  depositAmount: number;
  totalAmount: number;
}

/** Billing units in the listing's own rate period; a part period is charged as a whole one. */
export function billingUnits(ratePeriod: RatePeriod, days: number): number {
  if (ratePeriod === 'WEEK') return Math.ceil(days / 7);
  if (ratePeriod === 'MONTH') return Math.ceil(days / 30);
  return days;
}

/** Whole-rupee price: rental, the platform's fee on the rental, and the refundable deposit. */
export function priceBooking(input: {
  ratePeriod: RatePeriod;
  rate: number;
  days: number;
  depositAmount: number;
  serviceFeePercent: number;
}): BookingPrice {
  const units = billingUnits(input.ratePeriod, input.days);
  const rentalTotal = units * input.rate;
  const serviceFee = Math.round((rentalTotal * input.serviceFeePercent) / 100);
  return {
    units,
    rentalTotal,
    serviceFee,
    depositAmount: input.depositAmount,
    totalAmount: rentalTotal + serviceFee + input.depositAmount,
  };
}
