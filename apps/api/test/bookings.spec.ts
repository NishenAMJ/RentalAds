import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Booking, Listing } from '@prisma/client';
import { validateAttributes } from '../src/modules/categories/category-registry';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { toBookingView } from '../src/modules/bookings/booking-view';
import {
  billingUnits,
  parseCalendarDate,
  priceBooking,
  validateWindow,
} from '../src/modules/bookings/booking-rules';
import {
  PayhereService,
  notificationSignature,
} from '../src/modules/bookings/payhere.service';

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('booking dates and pricing', () => {
  const today = parseCalendarDate('2026-11-01');

  it('accepts real calendar dates only', () => {
    expect(parseCalendarDate('2026-11-05').toISOString()).toBe(
      '2026-11-05T00:00:00.000Z',
    );
    for (const bad of [
      '2026-02-31',
      '2026-13-01',
      '5/11/2026',
      '2026-11-5',
      '',
    ]) {
      expect(() => parseCalendarDate(bad)).toThrow(BadRequestException);
    }
  });

  it('rejects past, empty and overlong windows', () => {
    expect(
      validateWindow(
        parseCalendarDate('2026-11-03'),
        parseCalendarDate('2026-11-06'),
        today,
      ),
    ).toBe(3);
    expect(() =>
      validateWindow(
        parseCalendarDate('2026-10-31'),
        parseCalendarDate('2026-11-02'),
        today,
      ),
    ).toThrow('past');
    expect(() =>
      validateWindow(
        parseCalendarDate('2026-11-03'),
        parseCalendarDate('2026-11-03'),
        today,
      ),
    ).toThrow('after');
    expect(() =>
      validateWindow(
        parseCalendarDate('2026-11-03'),
        parseCalendarDate('2027-03-03'),
        today,
      ),
    ).toThrow('90');
  });

  it('prices rental, platform fee and deposit in whole rupees', () => {
    expect(
      priceBooking({
        ratePeriod: 'DAY',
        rate: 5000,
        days: 3,
        depositAmount: 10000,
        serviceFeePercent: 10,
      }),
    ).toEqual({
      units: 3,
      rentalTotal: 15000,
      serviceFee: 1500,
      depositAmount: 10000,
      totalAmount: 26500,
    });
  });

  it('charges a part period as a whole period', () => {
    expect(billingUnits('WEEK', 8)).toBe(2);
    expect(billingUnits('WEEK', 7)).toBe(1);
    expect(billingUnits('MONTH', 31)).toBe(2);
    expect(billingUnits('DAY', 4)).toBe(4);
  });
});

describe('category attributes', () => {
  const vehicle = {
    vehicleType: 'CAR',
    transmission: 'AUTOMATIC',
    fuel: 'HYBRID',
    seats: 5,
    withDriver: false,
  };

  it('keeps valid fields and drops nothing', () => {
    expect(validateAttributes('VEHICLE', vehicle)).toEqual(vehicle);
  });

  it('rejects unknown, missing, mistyped and out-of-range fields', () => {
    expect(() =>
      validateAttributes('VEHICLE', { ...vehicle, colour: 'red' }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateAttributes('VEHICLE', { ...vehicle, seats: undefined }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateAttributes('VEHICLE', { ...vehicle, seats: '5' }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateAttributes('VEHICLE', { ...vehicle, seats: 500 }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateAttributes('VEHICLE', { ...vehicle, fuel: 'COAL' }),
    ).toThrow(BadRequestException);
    expect(() => validateAttributes('EVENT_GEAR', null)).toThrow(
      BadRequestException,
    );
  });

  it('treats optional fields as optional', () => {
    expect(
      validateAttributes('EQUIPMENT', {
        equipmentType: 'CAMERA',
        condition: 'GOOD',
      }),
    ).toEqual({
      equipmentType: 'CAMERA',
      condition: 'GOOD',
    });
  });
});

describe('PayHere signing', () => {
  const credentials = {
    PAYHERE_MERCHANT_ID: '1200001',
    PAYHERE_MERCHANT_SECRET: 'top-secret',
  };
  const payhere = new PayhereService(config(credentials));
  const signed = (overrides: Record<string, string> = {}) => {
    const body = {
      merchant_id: '1200001',
      order_id: 'booking-1',
      payment_id: 'pay-9',
      payhere_amount: '26500.00',
      payhere_currency: 'LKR',
      status_code: '2',
      ...overrides,
    };
    return {
      ...body,
      md5sig: notificationSignature(
        body.merchant_id,
        body.order_id,
        body.payhere_amount,
        body.payhere_currency,
        body.status_code,
        'top-secret',
      ),
    };
  };

  it('accepts a correctly signed notification and rejects any tampering', () => {
    expect(payhere.verify(signed())).toBe(true);
    expect(payhere.verify({ ...signed(), payhere_amount: '1.00' })).toBe(false);
    expect(payhere.verify({ ...signed(), status_code: '-2' })).toBe(false);
    expect(payhere.verify({ ...signed(), md5sig: undefined })).toBe(false);
    expect(payhere.verify({ ...signed(), merchant_id: '999' })).toBe(false);
  });

  it('refuses to work until payment credentials are configured', () => {
    expect(() => new PayhereService(config({})).verify(signed())).toThrow(
      ServiceUnavailableException,
    );
  });

  it('builds a checkout form with the order, amount and a hash', () => {
    const checkout = payhere.checkout(
      { id: 'booking-1', totalAmount: 26500 },
      { email: 'a@b.test', phone: '+94771234567' },
      'Toyota Aqua',
    );
    expect(checkout.action).toContain('sandbox.payhere.lk');
    expect(checkout.fields).toMatchObject({
      order_id: 'booking-1',
      amount: '26500.00',
      currency: 'LKR',
    });
    expect(checkout.fields.hash).toMatch(/^[0-9A-F]{32}$/);
  });
});

describe('bookings service', () => {
  const now = new Date();
  const future = (days: number) =>
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + days,
      ),
    );
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  const listing = {
    id: 'listing-1',
    ownerId: 'owner-1',
    category: 'VEHICLE',
    title: 'Toyota Aqua',
    areaText: 'Galle',
    monthlyRent: 5000,
    ratePeriod: 'DAY',
    depositAmount: 10000,
    ownerContact: '+94770000000',
    photoUrls: [],
    ratePeriodNote: undefined,
  } as unknown as Listing;

  const pendingBooking = {
    id: 'booking-1',
    listingId: 'listing-1',
    renterId: 'renter-1',
    startDate: future(10),
    endDate: future(13),
    units: 3,
    rateAmount: 5000,
    rentalTotal: 15000,
    serviceFee: 1500,
    depositAmount: 10000,
    totalAmount: 26500,
    renterContact: '+94771234567',
    status: 'PENDING_PAYMENT',
    expiresAt: future(1),
    paidAt: null,
    paymentReference: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    listing,
  } as unknown as Booking & { listing: Listing };

  function build(
    overrides: {
      clash?: boolean;
      booking?: Partial<typeof pendingBooking> | null;
    } = {},
  ) {
    const notifySend = jest.fn().mockResolvedValue(undefined);
    const bookingUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      listing: { findFirst: jest.fn().mockResolvedValue(listing) },
      booking: {
        findFirst: jest
          .fn()
          .mockResolvedValue(overrides.clash ? { id: 'other' } : null),
        findUnique: jest
          .fn()
          .mockResolvedValue(
            overrides.booking === null
              ? null
              : { ...pendingBooking, ...overrides.booking },
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...pendingBooking, ...data, listing }),
          ),
        update: bookingUpdate,
        updateMany: bookingUpdate,
      },
      listingBlock: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest
        .fn()
        .mockImplementation((work: unknown) =>
          typeof work === 'function'
            ? (work as (tx: unknown) => unknown)(prisma)
            : Promise.all(work as unknown[]),
        ),
    };
    const users = {
      findOrCreate: jest
        .fn()
        .mockResolvedValue({ id: 'renter-1', email: 'r@x.test' }),
    };
    const service = new BookingsService(
      prisma as never,
      users as never,
      config({
        PAYHERE_MERCHANT_ID: '1200001',
        PAYHERE_MERCHANT_SECRET: 'top-secret',
      }),
      new PayhereService(
        config({
          PAYHERE_MERCHANT_ID: '1200001',
          PAYHERE_MERCHANT_SECRET: 'top-secret',
        }),
      ),
      { send: notifySend } as never,
    );
    return { service, prisma, users, bookingUpdate, notifySend };
  }

  const request = {
    listingId: 'listing-1',
    startDate: iso(future(10)),
    endDate: iso(future(13)),
    renterContact: '+94771234567',
  };
  const notification = (overrides: Record<string, string> = {}) => {
    const body = {
      merchant_id: '1200001',
      order_id: 'booking-1',
      payment_id: 'pay-9',
      payhere_amount: '26500.00',
      payhere_currency: 'LKR',
      status_code: '2',
      ...overrides,
    };
    return {
      ...body,
      md5sig: notificationSignature(
        body.merchant_id,
        body.order_id,
        body.payhere_amount,
        body.payhere_currency,
        body.status_code,
        'top-secret',
      ),
    };
  };

  it('creates an unpaid booking that holds the dates for a short while, without the owner contact', async () => {
    const { service, prisma } = build();
    const view = await service.create(
      { authUserId: 'a', email: 'r@x.test' },
      request,
    );
    expect(view.status).toBe('PENDING_PAYMENT');
    expect(view.totalAmount).toBe(26500);
    expect(view).not.toHaveProperty('ownerContact');
    expect(prisma.$queryRaw).toHaveBeenCalled();
    const stored = (
      prisma.booking.create.mock.calls[0] as [{ data: { expiresAt: Date } }]
    )[0].data;
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('refuses dates that clash with another booking', async () => {
    const { service } = build({ clash: true });
    await expect(
      service.create({ authUserId: 'a', email: 'r@x.test' }, request),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses renters booking their own item', async () => {
    const { service, users } = build();
    users.findOrCreate.mockResolvedValue({ id: 'owner-1', email: 'o@x.test' });
    await expect(
      service.create({ authUserId: 'a', email: 'o@x.test' }, request),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('confirms a paid booking and tells both people', async () => {
    const { service, bookingUpdate, notifySend } = build();
    await service.handlePayhereNotification(notification());
    expect(bookingUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'CONFIRMED',
      paymentReference: 'pay-9',
    });
    const [alerts] = notifySend.mock.calls[0] as [{ userId: string }[]];
    expect(alerts.map((alert) => alert.userId)).toEqual([
      'renter-1',
      'owner-1',
    ]);
  });

  it('ignores forged, mismatched, failed and repeated notifications', async () => {
    const forged = build();
    await expect(
      forged.service.handlePayhereNotification({
        ...notification(),
        md5sig: 'F'.repeat(32),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const wrongAmount = build();
    await wrongAmount.service.handlePayhereNotification(
      notification({ payhere_amount: '100.00' }),
    );
    const failed = build();
    await failed.service.handlePayhereNotification(
      notification({ status_code: '-2' }),
    );
    const repeated = build({
      booking: { paidAt: new Date(), status: 'CONFIRMED' },
    });
    await repeated.service.handlePayhereNotification(notification());
    for (const attempt of [forged, wrongAmount, failed, repeated])
      expect(attempt.bookingUpdate).not.toHaveBeenCalled();
  });

  it('records a payment that arrives after the dates were taken as a cancelled booking due a refund', async () => {
    const { service, bookingUpdate, notifySend } = build({
      clash: true,
    });
    await service.handlePayhereNotification(notification());
    expect(bookingUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED',
    });
    expect(bookingUpdate.mock.calls[0][0].data.paidAt).toBeInstanceOf(Date);
    expect(bookingUpdate.mock.calls[0][0].data).toMatchObject({
      refundAmount: 26500,
      refundStatus: 'DUE',
      cancelledBy: 'SYSTEM',
    });
    // Only the renter is told; the owner never hears about a booking that did not happen.
    const [alerts] = notifySend.mock.calls[0] as [{ userId: string }[]];
    expect(alerts.map((alert) => alert.userId)).toEqual(['renter-1']);
  });
});

describe('booking contact privacy', () => {
  const base = {
    id: 'b',
    startDate: new Date('2026-11-10'),
    endDate: new Date('2026-11-12'),
    renterContact: '+94771111111',
    paidAt: null,
    listing: {
      id: 'l',
      ownerContact: '+94772222222',
      photoUrls: [],
      ratePeriod: 'DAY',
      category: 'VEHICLE',
    },
  };
  const view = (status: string, viewer: 'renter' | 'owner' | 'admin') =>
    toBookingView({ ...base, status } as never, viewer, new Date('2026-11-01'));

  it('shows the other side phone number only once the booking is paid', () => {
    expect(view('PENDING_PAYMENT', 'renter')).not.toHaveProperty(
      'ownerContact',
    );
    expect(view('CONFIRMED', 'renter')).toHaveProperty(
      'ownerContact',
      '+94772222222',
    );
    expect(view('PENDING_PAYMENT', 'owner')).not.toHaveProperty(
      'renterContact',
    );
    expect(view('CONFIRMED', 'owner')).toHaveProperty(
      'renterContact',
      '+94771111111',
    );
    expect(view('CONFIRMED', 'renter')).not.toHaveProperty('renterContact');
  });

  it('shows an unpaid booking whose hold has run out as expired, and a live one as waiting', () => {
    const unpaid = (expiresAt: string) =>
      toBookingView(
        {
          ...base,
          status: 'PENDING_PAYMENT',
          expiresAt: new Date(expiresAt),
        } as never,
        'renter',
        new Date('2026-11-01T10:00:00Z'),
      ).status;
    expect(unpaid('2026-11-01T09:59:00Z')).toBe('EXPIRED');
    expect(unpaid('2026-11-01T10:20:00Z')).toBe('PENDING_PAYMENT');
  });

  it('shows a finished confirmed booking as completed', () => {
    expect(
      toBookingView(
        { ...base, status: 'CONFIRMED' } as never,
        'renter',
        new Date('2026-11-20'),
      ).status,
    ).toBe('COMPLETED');
  });

  it('flags a paid but cancelled booking for refund, to admins only', () => {
    const paid = {
      ...base,
      status: 'CANCELLED',
      paidAt: new Date(),
      refundStatus: 'DUE',
      refundAmount: 100,
    } as never;
    expect(toBookingView(paid, 'admin')).toHaveProperty('refundDue', true);
    expect(toBookingView(paid, 'renter')).not.toHaveProperty('refundDue');
  });
});
