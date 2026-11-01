/// <reference types="jest" />
import {
  availabilityPolicy,
  cutoffDate,
  freshSince,
  isStale,
  unconfirmedSince,
} from '../src/modules/listings/availability';
import { AvailabilityReminderService } from '../src/modules/listings/availability-reminder.service';
import { ListingsService } from '../src/modules/listings/listings.service';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-15T09:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
const config = (values: Record<string, string> = {}) =>
  ({ get: (key: string) => values[key] }) as never;

describe('availabilityPolicy', () => {
  it('defaults to 60 days stale with a reminder at 45', () => {
    expect(availabilityPolicy(config())).toEqual({
      staleDays: 60,
      reminderDays: 45,
    });
  });

  it('honours configuration but always reminds before hiding', () => {
    expect(
      availabilityPolicy(
        config({ LISTING_STALE_DAYS: '30', LISTING_REMINDER_DAYS: '20' }),
      ),
    ).toEqual({ staleDays: 30, reminderDays: 20 });
    expect(
      availabilityPolicy(
        config({ LISTING_STALE_DAYS: '30', LISTING_REMINDER_DAYS: '90' }),
      ).reminderDays,
    ).toBeLessThan(30);
  });

  it.each(['abc', '-5', '0', '1.5', ''])(
    'ignores the invalid value %j',
    (value) => {
      expect(availabilityPolicy(config({ LISTING_STALE_DAYS: value }))).toEqual(
        { staleDays: 60, reminderDays: 45 },
      );
    },
  );
});

describe('staleness', () => {
  const cutoff = cutoffDate(now, 60);

  it('counts days back from now', () => {
    expect(cutoff).toEqual(daysAgo(60));
  });

  it('uses the last confirmation, or the submission date if never confirmed', () => {
    expect(
      isStale(
        {
          lastAvailabilityConfirmedAt: daysAgo(10),
          createdAt: daysAgo(200),
        },
        cutoff,
      ),
    ).toBe(false);
    expect(
      isStale(
        {
          lastAvailabilityConfirmedAt: daysAgo(90),
          createdAt: daysAgo(10),
        },
        cutoff,
      ),
    ).toBe(true);
    expect(
      isStale(
        { lastAvailabilityConfirmedAt: null, createdAt: daysAgo(10) },
        cutoff,
      ),
    ).toBe(false);
    expect(
      isStale(
        { lastAvailabilityConfirmedAt: null, createdAt: daysAgo(100) },
        cutoff,
      ),
    ).toBe(true);
  });

  it('builds complementary database filters', () => {
    expect(freshSince(cutoff)).toEqual({
      OR: [
        { lastAvailabilityConfirmedAt: { gte: cutoff } },
        { lastAvailabilityConfirmedAt: null, createdAt: { gte: cutoff } },
      ],
    });
    expect(unconfirmedSince(cutoff)).toEqual({
      OR: [
        { lastAvailabilityConfirmedAt: { lt: cutoff } },
        { lastAvailabilityConfirmedAt: null, createdAt: { lt: cutoff } },
      ],
    });
  });
});

describe('AvailabilityReminderService', () => {
  function build(due: object[], claims: number[] = []) {
    const tx = {
      listing: {
        updateMany: jest.fn(() =>
          Promise.resolve({ count: claims.shift() ?? 1 }),
        ),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      listing: {
        findMany: jest.fn().mockResolvedValueOnce(due).mockResolvedValue([]),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    return {
      tx,
      prisma,
      service: new AvailabilityReminderService(prisma as never, config()),
    };
  }
  const listing = (id: string, reference: string | null = null) => ({
    id,
    ownerId: `owner-${id}`,
    reference,
    areaText: 'Colombo 5',
  });

  it('only looks at active, live, not-yet-reminded, unconfirmed listings', async () => {
    const { prisma, service } = build([]);
    await service.sendReminders(now);
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          reminderSentAt: null,
          AND: [unconfirmedSince(daysAgo(45))],
        },
      }),
    );
  });

  it('notifies each owner once and records that the reminder was sent', async () => {
    const { tx, service } = build([listing('a', 'SL-000001'), listing('b')]);
    await expect(service.sendReminders(now)).resolves.toBe(2);
    expect(tx.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 'a', reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'owner-a',
        type: 'AVAILABILITY_REMINDER',
        message: expect.stringContaining('SL-000001'),
      }),
    });
    expect(tx.notification.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        message: expect.stringContaining('Colombo 5'),
      }),
    });
  });

  it('does not send a duplicate when another instance already claimed the listing', async () => {
    const { tx, service } = build([listing('a')], [0]);
    await expect(service.sendReminders(now)).resolves.toBe(0);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});

describe('ListingsService availability rules', () => {
  const build = (prisma: object) =>
    new ListingsService(
      prisma as never,
      { findOrCreate: jest.fn() } as never,
      config(),
      { send: jest.fn() } as never,
    );

  it('hides listings whose availability has lapsed from public browsing', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await build({ listing: { findMany } }).browse({ page: 1, limit: 20 });
    const where = (findMany.mock.calls[0] as [{ where: object }])[0].where;
    expect(where).toMatchObject({ status: 'ACTIVE', deletedAt: null });
    expect(where).toHaveProperty('AND.0.OR');
  });

  it('shows owners which approved listings are currently hidden', async () => {
    const stale = {
      id: 'old',
      status: 'ACTIVE',
      lastAvailabilityConfirmedAt: new Date(Date.now() - 90 * DAY),
      createdAt: new Date(Date.now() - 120 * DAY),
    };
    const pending = {
      id: 'new',
      status: 'PENDING_APPROVAL',
      lastAvailabilityConfirmedAt: null,
      createdAt: new Date(Date.now() - 120 * DAY),
    };
    const findMany = jest.fn().mockResolvedValue([stale, pending]);
    const users = {
      findOrCreate: jest.fn().mockResolvedValue({ id: 'owner' }),
    };
    const service = new ListingsService(
      { listing: { findMany } } as never,
      users as never,
      config(),
      { send: jest.fn() } as never,
    );
    const result = await service.mine({ authUserId: 'a' } as never, {
      page: 1,
      limit: 20,
    });
    expect(result.data.map((row) => row.availabilityStale)).toEqual([
      true,
      false,
    ]);
  });
});
