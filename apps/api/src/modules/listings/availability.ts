import type { Listing, Prisma } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_STALE_DAYS = 60;
export const DEFAULT_REMINDER_DAYS = 45;

export interface AvailabilityPolicy {
  /** Listings unconfirmed for this many days are hidden from public browsing. */
  staleDays: number;
  /** Owners are reminded after this many days without confirmation. */
  reminderDays: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads LISTING_STALE_DAYS and LISTING_REMINDER_DAYS. The reminder always
 * comes before the listing is hidden, so owners get a chance to react.
 */
export function availabilityPolicy(config: ConfigService): AvailabilityPolicy {
  const staleDays = positiveInt(
    config.get<string>('LISTING_STALE_DAYS'),
    DEFAULT_STALE_DAYS,
  );
  const reminderDays = Math.min(
    positiveInt(
      config.get<string>('LISTING_REMINDER_DAYS'),
      DEFAULT_REMINDER_DAYS,
    ),
    staleDays - 1 || 1,
  );
  return { staleDays, reminderDays };
}

export const cutoffDate = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS);

/**
 * Availability is "last confirmed by the owner", or the submission date if they
 * never confirmed. Matches listings confirmed on or after `cutoff`.
 */
export function freshSince(cutoff: Date): Prisma.ListingWhereInput {
  return {
    OR: [
      { lastAvailabilityConfirmedAt: { gte: cutoff } },
      { lastAvailabilityConfirmedAt: null, createdAt: { gte: cutoff } },
    ],
  };
}

/** The opposite of {@link freshSince}: listings not confirmed since `cutoff`. */
export function unconfirmedSince(cutoff: Date): Prisma.ListingWhereInput {
  return {
    OR: [
      { lastAvailabilityConfirmedAt: { lt: cutoff } },
      { lastAvailabilityConfirmedAt: null, createdAt: { lt: cutoff } },
    ],
  };
}

export function isStale(
  listing: Pick<Listing, 'lastAvailabilityConfirmedAt' | 'createdAt'>,
  cutoff: Date,
): boolean {
  const confirmed = listing.lastAvailabilityConfirmedAt ?? listing.createdAt;
  return confirmed < cutoff;
}

/**
 * Which listings the public may see and book: approved, not deleted, and recently confirmed by their owner.
 * Browsing and booking share this so a hidden listing can never be booked.
 */
export function publicVisibility(config: ConfigService, now = new Date()) {
  const { staleDays } = availabilityPolicy(config);
  return {
    status: 'ACTIVE' as const,
    deletedAt: null,
    AND: [freshSince(cutoffDate(now, staleDays))],
  };
}
