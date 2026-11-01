/// <reference types="jest" />
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingsService } from '../src/modules/listings/listings.service';
import { MatchingService } from '../src/modules/matching/matching.service';
import { RequestsService } from '../src/modules/RequestsModule/requests.service';

const deletedAt = new Date('2026-01-01');
const deletedListing = { id: 'l1', ownerId: 'owner', deletedAt };
const deletedRequest = {
  id: 'r1',
  renterId: 'renter',
  status: 'OPEN',
  deletedAt,
};

describe('soft-deleted listings', () => {
  const build = (prisma: object) =>
    new ListingsService(
      prisma as never,
      { findOrCreate: jest.fn() } as never,
      { get: () => undefined } as never,
      { send: jest.fn() } as never,
    );

  it('cannot be approved or rejected', async () => {
    const prisma = {
      listing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(build(prisma).moderate('l1', 'ACTIVE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: 'l1', status: 'PENDING_APPROVAL', deletedAt: null },
      data: { status: 'ACTIVE' },
    });
  });

  it('still reports a conflict for live listings that are not pending', async () => {
    const prisma = {
      listing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'l1' }),
      },
    };
    await expect(build(prisma).moderate('l1', 'ACTIVE')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cannot have availability reconfirmed', async () => {
    const prisma = {
      listing: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new ListingsService(
      prisma as never,
      {
        findOrCreate: jest.fn().mockResolvedValue({ id: 'owner' }),
      } as never,
      { get: () => undefined } as never,
      { send: jest.fn() } as never,
    );
    await expect(
      service.reconfirm({ authUserId: 'auth' } as never, 'l1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'l1', ownerId: 'owner', deletedAt: null },
      }),
    );
  });

  it('are hidden from the admin ID lookup', async () => {
    const prisma = {
      listing: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(build(prisma).adminLookup('SL-000001')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.listing.findFirst).toHaveBeenCalledWith({
      where: { reference: 'SL-000001', deletedAt: null },
    });
  });

  it('are not deletable twice, and only by their owner', async () => {
    const prisma = {
      listing: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(deletedListing)
          .mockResolvedValueOnce({ id: 'l2', ownerId: 'owner' }),
      },
    };
    const service = build(prisma);
    await expect(service.remove('l1', 'owner')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('l2', 'intruder')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('soft-deleted rental requests', () => {
  it('are excluded from the admin list', async () => {
    const prisma = {
      rentalRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await new RequestsService(prisma as never).findAllForAdmin({
      page: 1,
      limit: 20,
    });
    expect(prisma.rentalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('cannot be closed', async () => {
    const prisma = {
      rentalRequest: {
        findUnique: jest.fn().mockResolvedValue(deletedRequest),
        update: jest.fn(),
      },
    };
    await expect(
      new RequestsService(prisma as never).close('renter', 'r1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.rentalRequest.update).not.toHaveBeenCalled();
  });
});

describe('matching with soft-deleted records', () => {
  const live = { id: 'l1', status: 'ACTIVE', deletedAt: null };
  const build = (prisma: object) => new MatchingService(prisma as never);

  it('rejects recommending a listing for a deleted request', async () => {
    const prisma = {
      rentalRequest: {
        findUnique: jest.fn().mockResolvedValue(deletedRequest),
      },
      match: { upsert: jest.fn() },
    };
    await expect(
      build(prisma).saveSuggestion('r1', 'l1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.match.upsert).not.toHaveBeenCalled();
  });

  it('rejects recommending a deleted listing', async () => {
    const prisma = {
      rentalRequest: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...deletedRequest, deletedAt: null }),
      },
      listing: { findUnique: jest.fn().mockResolvedValue(deletedListing) },
      match: { upsert: jest.fn() },
    };
    await expect(
      build(prisma).saveSuggestion('r1', 'l1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.match.upsert).not.toHaveBeenCalled();
  });

  it('rejects candidate lookup for a deleted request', async () => {
    const prisma = {
      rentalRequest: {
        findUnique: jest.fn().mockResolvedValue(deletedRequest),
      },
      listing: { findUnique: jest.fn().mockResolvedValue(live) },
    };
    await expect(
      build(prisma).lookupCandidate(
        'r1',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only valid saved matches', async () => {
    const prisma = { match: { findMany: jest.fn().mockResolvedValue([]) } };
    await build(prisma).savedMatches('r1', { page: 1, limit: 20 });
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requestId: 'r1', invalidatedAt: null },
      }),
    );
  });

  it('refuses status changes on invalidated matches', async () => {
    const prisma = {
      match: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'm1',
          requestId: 'r1',
          invalidatedAt: deletedAt,
        }),
        update: jest.fn(),
      },
    };
    await expect(
      build(prisma).updateStatus('m1', 'SENT'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.match.update).not.toHaveBeenCalled();
  });
});
