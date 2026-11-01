import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { PayhereService } from '../src/modules/bookings/payhere.service';
import {
  DEFAULT_CANCELLATION_POLICY,
  cancellationPolicy,
  renterRefund,
} from '../src/modules/bookings/cancellation-policy';
import { parseCalendarDate } from '../src/modules/bookings/booking-rules';
import { ListingsService } from '../src/modules/listings/listings.service';
import { MailerService } from '../src/modules/notifications/mailer.service';
import { NotifyService } from '../src/modules/notifications/notify.service';

const config = (values: Record<string, string> = {}) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const day = (iso: string) => parseCalendarDate(iso);
const paid = { rentalTotal: 15000, depositAmount: 10000, totalAmount: 26500 };

describe('renter refund policy', () => {
  const today = day('2026-12-01');
  const booking = (startsOn: string) => ({ ...paid, startDate: day(startsOn) });

  it('refunds everything when cancelling a week or more ahead', () => {
    expect(renterRefund(booking('2026-12-08'), today)).toEqual({
      rule: 'FULL',
      refundAmount: 26500,
      daysBeforeStart: 7,
    });
    expect(renterRefund(booking('2027-01-20'), today).rule).toBe('FULL');
  });

  it('keeps the service fee and half the rental when cancelling two to six days ahead', () => {
    expect(renterRefund(booking('2026-12-03'), today)).toEqual({
      rule: 'PARTIAL',
      refundAmount: 10000 + 7500,
      daysBeforeStart: 2,
    });
    expect(renterRefund(booking('2026-12-07'), today).rule).toBe('PARTIAL');
  });

  it('returns only the deposit when cancelling at the last minute', () => {
    expect(renterRefund(booking('2026-12-02'), today)).toEqual({
      rule: 'DEPOSIT_ONLY',
      refundAmount: 10000,
      daysBeforeStart: 1,
    });
    expect(renterRefund(booking('2026-12-01'), today).rule).toBe(
      'DEPOSIT_ONLY',
    );
  });

  it('does not allow cancelling a rental that has started', () => {
    expect(() => renterRefund(booking('2026-11-30'), today)).toThrow(
      BadRequestException,
    );
  });

  it('reads its limits from settings and falls back to safe defaults for bad values', () => {
    expect(cancellationPolicy(config())).toEqual(DEFAULT_CANCELLATION_POLICY);
    expect(
      cancellationPolicy(
        config({
          CANCEL_FULL_REFUND_DAYS: '14',
          CANCEL_PARTIAL_REFUND_DAYS: '3',
          CANCEL_PARTIAL_REFUND_PERCENT: '25',
        }),
      ),
    ).toEqual({
      fullRefundDays: 14,
      partialRefundDays: 3,
      partialRefundPercent: 25,
    });
    expect(
      cancellationPolicy(
        config({
          CANCEL_FULL_REFUND_DAYS: 'abc',
          CANCEL_PARTIAL_REFUND_PERCENT: '500',
        }),
      ),
    ).toEqual(DEFAULT_CANCELLATION_POLICY);
    // The partial window can never be longer than the full one.
    expect(
      cancellationPolicy(
        config({
          CANCEL_FULL_REFUND_DAYS: '3',
          CANCEL_PARTIAL_REFUND_DAYS: '10',
        }),
      ).partialRefundDays,
    ).toBe(3);
  });
});

describe('cancelling bookings', () => {
  const inDays = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return day(date.toISOString().slice(0, 10));
  };
  const listing = {
    id: 'l1',
    ownerId: 'owner-1',
    title: 'Toyota Aqua',
    areaText: 'Galle',
  };
  const confirmed = (startsInDays: number) => ({
    id: 'b1',
    listingId: 'l1',
    renterId: 'renter-1',
    status: 'CONFIRMED',
    startDate: inDays(startsInDays),
    endDate: inDays(startsInDays + 3),
    ...paid,
    paidAt: new Date(),
    listing,
  });

  function build(booking: object | null, updated = 1) {
    const prisma = {
      booking: {
        findFirst: jest.fn().mockResolvedValue(booking),
        findUnique: jest.fn().mockResolvedValue(booking),
        updateMany: jest.fn().mockResolvedValue({ count: updated }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const users = {
      findOrCreate: jest
        .fn()
        .mockResolvedValue({ id: 'renter-1', email: 'r@x.test' }),
    };
    const notify = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new BookingsService(
      prisma as never,
      users as never,
      config(),
      new PayhereService(config()),
      notify as never,
    );
    return { service, prisma, users, notify };
  }

  it('shows the renter what they would get back before they confirm', async () => {
    const { service } = build(confirmed(10));
    await expect(
      service.cancelQuote({ authUserId: 'a', email: 'r@x.test' }, 'b1'),
    ).resolves.toMatchObject({ rule: 'FULL', refundAmount: 26500 });
  });

  it('records the refund owed when a renter cancels a paid booking, and tells both people', async () => {
    const { service, prisma, notify } = build(confirmed(3));
    const result = await service.cancelByRenter(
      { authUserId: 'a', email: 'r@x.test' },
      'b1',
    );
    expect(result).toMatchObject({ status: 'CANCELLED', refundAmount: 17500 });
    const [{ data, where }] = prisma.booking.updateMany.mock.calls[0] as [
      { data: Record<string, unknown>; where: Record<string, unknown> },
    ];
    expect(where).toMatchObject({ id: 'b1', status: 'CONFIRMED' });
    expect(data).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'RENTER',
      refundAmount: 17500,
      refundStatus: 'DUE',
    });
    const [alerts] = notify.send.mock.calls[0] as [{ userId: string }[]];
    expect(alerts.map((alert) => alert.userId)).toEqual([
      'owner-1',
      'renter-1',
    ]);
  });

  it('records no refund when the policy returns nothing', async () => {
    const { service, prisma } = build({
      ...confirmed(1),
      depositAmount: 0,
      totalAmount: 16500,
    });
    await service.cancelByRenter({ authUserId: 'a', email: 'r@x.test' }, 'b1');
    const [{ data }] = prisma.booking.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({ refundAmount: 0, refundStatus: 'NONE' });
  });

  it('only frees the dates for an unpaid booking and refunds nothing', async () => {
    const { service, prisma } = build({
      ...confirmed(10),
      status: 'PENDING_PAYMENT',
      paidAt: null,
    });
    await expect(
      service.cancelByRenter({ authUserId: 'a', email: 'r@x.test' }, 'b1'),
    ).resolves.toMatchObject({ refundAmount: 0 });
    expect(prisma.booking.updateMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'PENDING_PAYMENT' },
    });
  });

  it("cannot cancel twice, and cannot cancel someone else's booking", async () => {
    await expect(
      build(confirmed(10), 0).service.cancelByRenter(
        { authUserId: 'a', email: 'r@x.test' },
        'b1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(null).service.cancelByRenter(
        { authUserId: 'a', email: 'r@x.test' },
        'b1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refunds the renter in full when the owner cancels, and says why', async () => {
    const { service, prisma, users, notify } = build(confirmed(2));
    users.findOrCreate.mockResolvedValue({ id: 'owner-1', email: 'o@x.test' });
    await service.cancelByOwner(
      { authUserId: 'o', email: 'o@x.test' },
      'b1',
      'The car broke down',
    );
    const [{ data }] = prisma.booking.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({
      cancelledBy: 'OWNER',
      refundAmount: 26500,
      refundStatus: 'DUE',
      cancelReason: 'The car broke down',
    });
    const [alerts] = notify.send.mock.calls[0] as [
      { userId: string; message: string }[],
    ];
    expect(alerts).toHaveLength(1);
    expect(alerts[0].userId).toBe('renter-1');
    expect(alerts[0].message).toContain('The car broke down');
  });

  it('marks a refund as sent only once', async () => {
    const sent = build({
      ...confirmed(1),
      status: 'CANCELLED',
      refundStatus: 'DUE',
      refundAmount: 26500,
    });
    await expect(sent.service.markRefunded('b1', ' REF-1 ')).resolves.toEqual({
      id: 'b1',
      refundStatus: 'DONE',
    });
    expect(sent.prisma.booking.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'b1', refundStatus: 'DUE' },
      data: { refundStatus: 'DONE', refundReference: 'REF-1' },
    });
    await expect(
      build({ ...confirmed(1), status: 'CANCELLED' }, 0).service.markRefunded(
        'b1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refunds a paid booking in full when the team cancels it', async () => {
    const { service, prisma } = build(confirmed(5));
    await expect(
      service.adminCancel('b1', 'Listing removed'),
    ).resolves.toMatchObject({ refundAmount: 26500 });
    expect(prisma.booking.update.mock.calls[0][0]).toMatchObject({
      data: { cancelledBy: 'ADMIN', refundStatus: 'DUE' },
    });
  });
});

describe('owner edits and blocked dates', () => {
  const item = {
    id: 'l1',
    ownerId: 'owner-1',
    category: 'VEHICLE',
    status: 'ACTIVE',
    keyMoney: false,
    keyMoneyAmount: null,
  };
  const home = { ...item, category: 'PROPERTY', keyMoney: false };

  function build(listing: object | null) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      listingBlock: {
        create: jest.fn().mockResolvedValue({ id: 'blk', note: null }),
      },
    };
    const prisma = {
      listing: {
        findFirst: jest.fn().mockResolvedValue(listing),
        update: jest.fn().mockResolvedValue({}),
      },
      listingBlock: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((work: (client: unknown) => unknown) => work(tx)),
    };
    const users = {
      findOrCreate: jest.fn().mockResolvedValue({ id: 'owner-1' }),
    };
    const service = new ListingsService(
      prisma as never,
      users as never,
      config(),
      { send: jest.fn() } as never,
    );
    return { service, prisma, tx };
  }
  const me = { authUserId: 'o', email: 'o@x.test' };

  it('applies price, deposit and contact changes at once without sending the listing back for review', async () => {
    const { service, prisma } = build(item);
    await service.update(me, 'l1', {
      rate: 6000,
      depositAmount: 12000,
      ownerContact: '+94771112222',
    });
    const [{ data }] = prisma.listing.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({
      monthlyRent: 6000,
      depositAmount: 12000,
      ownerContact: '+94771112222',
    });
    expect(data).not.toHaveProperty('status');
  });

  it('sends a live listing back for review when what renters read or see changes', async () => {
    for (const change of [
      { title: 'Honda Fit' },
      { description: 'New text' },
      { photoUrls: ['https://x.test/a.jpg'] },
      { areaText: 'Kandy' },
    ]) {
      const { service, prisma } = build(item);
      await service.update(me, 'l1', change);
      const [{ data }] = prisma.listing.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data).toMatchObject({ status: 'PENDING_APPROVAL' });
    }
  });

  it('lets a rejected listing be corrected and resubmitted, but never reopens one an admin switched off', async () => {
    const rejected = build({ ...item, status: 'REJECTED' });
    await rejected.service.update(me, 'l1', { title: 'Fixed title' });
    expect(rejected.prisma.listing.update.mock.calls[0][0].data).toMatchObject({
      status: 'PENDING_APPROVAL',
    });
    const inactive = build({ ...item, status: 'INACTIVE' });
    await inactive.service.update(me, 'l1', { title: 'Fixed title' });
    expect(
      inactive.prisma.listing.update.mock.calls[0][0].data,
    ).not.toHaveProperty('status');
  });

  it('validates the category fields when they change', async () => {
    const { service } = build(item);
    await expect(
      service.update(me, 'l1', { attributes: { vehicleType: 'BOAT' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects fields that do not belong to the listing, empty edits and periods the category cannot use', async () => {
    await expect(
      build(item).service.update(me, 'l1', { monthlyRent: 5 }),
    ).rejects.toThrow('cannot be changed');
    await expect(
      build(home).service.update(me, 'l1', { rate: 5 }),
    ).rejects.toThrow('cannot be changed');
    await expect(build(item).service.update(me, 'l1', {})).rejects.toThrow(
      'Nothing to change',
    );
    await expect(
      build({ ...item, category: 'EVENT_GEAR' }).service.update(me, 'l1', {
        ratePeriod: 'WEEK',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only lets owners edit their own listing', async () => {
    await expect(
      build(null).service.update(me, 'l1', { rate: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps key money consistent for homes', async () => {
    await expect(
      build(home).service.update(me, 'l1', { keyMoney: true }),
    ).rejects.toThrow('amount');
    const { service, prisma } = build(home);
    await service.update(me, 'l1', { keyMoney: false });
    expect(prisma.listing.update.mock.calls[0][0].data).toMatchObject({
      keyMoney: false,
      keyMoneyAmount: null,
    });
  });

  it('blocks dates for an item and refuses when a renter already holds them', async () => {
    const free = build(item);
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 10);
    const start = future.toISOString().slice(0, 10);
    future.setUTCDate(future.getUTCDate() + 3);
    const end = future.toISOString().slice(0, 10);
    await expect(
      free.service.addBlock(me, 'l1', { startDate: start, endDate: end }),
    ).resolves.toMatchObject({ id: 'blk', startDate: start, endDate: end });
    expect(free.tx.$queryRaw).toHaveBeenCalled();

    const taken = build(item);
    taken.tx.booking.findFirst.mockResolvedValue({ id: 'b1' });
    await expect(
      taken.service.addBlock(me, 'l1', { startDate: start, endDate: end }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(taken.tx.listingBlock.create).not.toHaveBeenCalled();
  });

  it('refuses blocks in the past, backwards, too long, or on a home', async () => {
    const { service } = build(item);
    await expect(
      service.addBlock(me, 'l1', {
        startDate: '2020-01-01',
        endDate: '2020-01-05',
      }),
    ).rejects.toThrow('past');
    await expect(
      service.addBlock(me, 'l1', {
        startDate: '2099-01-05',
        endDate: '2099-01-05',
      }),
    ).rejects.toThrow('after');
    await expect(
      service.addBlock(me, 'l1', {
        startDate: '2099-01-05',
        endDate: '2100-06-05',
      }),
    ).rejects.toThrow('365');
    await expect(
      build(home).service.addBlock(me, 'l1', {
        startDate: '2099-01-05',
        endDate: '2099-01-06',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("removes a block only from the owner's own listing", async () => {
    const { service, prisma } = build(item);
    await service.removeBlock(me, 'l1', 'blk');
    expect(prisma.listingBlock.deleteMany).toHaveBeenCalledWith({
      where: { id: 'blk', listingId: 'l1' },
    });
    prisma.listingBlock.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.removeBlock(me, 'l1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('alerts', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does nothing without an email provider and never throws', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const mailer = new MailerService(config());
    expect(mailer.enabled).toBe(false);
    await mailer.send({ to: 'a@b.test', subject: 's', text: 't' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the provider when configured, and swallows provider failures', async () => {
    const mailer = new MailerService(
      config({
        RESEND_API_KEY: 'key',
        EMAIL_FROM: 'RentalHub <hello@rental.test>',
      }),
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    await mailer.send({ to: 'a@b.test', subject: 'Hello', text: 'Body' });
    const [url, init] = fetchSpy.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer key');
    expect(JSON.parse(init.body)).toMatchObject({
      to: ['a@b.test'],
      subject: 'Hello',
    });
    fetchSpy.mockRejectedValue(new Error('network down'));
    await expect(
      mailer.send({ to: 'a@b.test', subject: 's', text: 't' }),
    ).resolves.toBeUndefined();
  });

  it('saves the in-site notification, then emails each person once with a link', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      notification: { createMany: jest.fn().mockResolvedValue({}) },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'u1', email: 'u1@x.test' }]),
      },
    };
    const notify = new NotifyService(
      prisma as never,
      { enabled: true, send } as never,
      config({ FRONTEND_URL: 'https://rental.test/' }),
    );
    await notify.send([
      {
        userId: 'u1',
        type: 'BOOKING_CONFIRMED',
        title: 'Confirmed',
        message: 'See you',
        link: '/bookings',
      },
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(prisma.notification.createMany.mock.calls[0][0]).toEqual({
      data: [
        {
          userId: 'u1',
          type: 'BOOKING_CONFIRMED',
          title: 'Confirmed',
          message: 'See you',
        },
      ],
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      (send.mock.calls[0] as [{ to: string; text: string }])[0],
    ).toMatchObject({ to: 'u1@x.test', subject: 'Confirmed' });
    expect((send.mock.calls[0] as [{ text: string }])[0].text).toContain(
      'https://rental.test/bookings',
    );
  });

  it('never throws when saving the notification fails', async () => {
    const prisma = {
      notification: {
        createMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
      user: { findMany: jest.fn() },
    };
    const notify = new NotifyService(
      prisma as never,
      { enabled: false } as never,
      config(),
    );
    await expect(
      notify.send([
        { userId: 'u1', type: 'BOOKING_CONFIRMED', title: 't', message: 'm' },
      ]),
    ).resolves.toBeUndefined();
  });
});
