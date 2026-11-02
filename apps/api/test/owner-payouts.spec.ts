import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../src/common/prisma.service';
import { OwnerPayoutsService } from '../src/modules/admin/owner-payouts.service';

describe('OwnerPayoutsService', () => {
  const authUserId = 'auth-admin';
  const bookingId = '11111111-1111-4111-8111-111111111111';
  const payoutId = '22222222-2222-4222-8222-222222222222';
  const booking = (overrides: Record<string, unknown> = {}) => ({
    id: bookingId,
    status: 'COMPLETED',
    paidAt: new Date(),
    renterId: 'renter-db',
    listing: { ownerId: 'owner-db' },
    ownerPayout: null,
    ...overrides,
  });
  const setup = () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-db' }) },
      booking: { findUnique: jest.fn().mockResolvedValue(booking()) },
      ownerPayout: {
        create: jest.fn().mockResolvedValue({ id: payoutId, status: 'DUE' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: payoutId, status: 'DUE' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return {
      prisma,
      service: new OwnerPayoutsService(
        prisma as unknown as PrismaService,
        { record: jest.fn() } as never,
      ),
    };
  };

  it('creates a reviewed due obligation without calling a payment provider', async () => {
    const { prisma, service } = setup();
    await expect(
      service.create(authUserId, {
        bookingId,
        amount: 8000,
        note: 'Pilot payout',
      }),
    ).resolves.toMatchObject({ status: 'DUE' });
    expect(prisma.ownerPayout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId,
        ownerId: 'owner-db',
        amount: 8000,
        createdById: 'admin-db',
      }),
    });
  });

  it.each([
    [booking({ status: 'CONFIRMED' }), 'Only completed bookings'],
    [booking({ paidAt: null }), 'must be paid'],
    [booking({ renterId: 'owner-db' }), 'cannot receive'],
    [booking({ ownerPayout: { id: payoutId } }), 'already exists'],
  ])('rejects ineligible booking records', async (record, message) => {
    const { prisma, service } = setup();
    prisma.booking.findUnique.mockResolvedValue(record);
    await expect(
      service.create(authUserId, { bookingId, amount: 8000 }),
    ).rejects.toThrow(message);
  });

  it('requires an existing admin and booking', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.create(authUserId, { bookingId, amount: 8000 }),
    ).rejects.toThrow(NotFoundException);
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-db' });
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(
      service.create(authUserId, { bookingId, amount: 8000 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('records a transfer only once and requires the admin to supply its reference', async () => {
    const { prisma, service } = setup();
    await expect(
      service.markPaid(authUserId, payoutId, { transferReference: 'BANK-123' }),
    ).resolves.toMatchObject({ id: payoutId });
    expect(prisma.ownerPayout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: payoutId, status: 'DUE' },
        data: expect.objectContaining({
          status: 'PAID',
          transferReference: 'BANK-123',
        }),
      }),
    );
    prisma.ownerPayout.findUnique.mockResolvedValue(null);
    await expect(
      service.markPaid(authUserId, payoutId, { transferReference: 'BANK-123' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects duplicate or concurrently completed transfers', async () => {
    const { prisma, service } = setup();
    prisma.ownerPayout.findUnique.mockResolvedValue({
      id: payoutId,
      status: 'PAID',
    });
    await expect(
      service.markPaid(authUserId, payoutId, { transferReference: 'BANK-123' }),
    ).rejects.toThrow(ConflictException);
    prisma.ownerPayout.findUnique.mockResolvedValue({
      id: payoutId,
      status: 'DUE',
    });
    prisma.ownerPayout.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.markPaid(authUserId, payoutId, { transferReference: 'BANK-123' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid status filters', async () => {
    const { service } = setup();
    await expect(service.list('anything')).rejects.toThrow(BadRequestException);
  });
});
