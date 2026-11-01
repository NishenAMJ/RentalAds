import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from '../src/modules/admin/admin.service';
import { ListingsService } from '../src/modules/listings/listings.service';

const listingsWith = (prisma: object) =>
  new ListingsService(
    prisma as never,
    {} as never,
    { get: () => undefined } as never,
    { send: jest.fn() } as never,
  );

describe('admin listing management', () => {
  const row = { id: 'l1', status: 'INACTIVE' };

  it('moves a listing only from the status the admin acted on', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      listing: {
        updateMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      },
    };
    await expect(listingsWith(prisma).deactivate('l1')).resolves.toBe(row);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'l1', status: 'ACTIVE', deletedAt: null },
      data: { status: 'INACTIVE' },
    });
  });

  it('reports a conflict when the listing is not in the expected status', async () => {
    const prisma = {
      listing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(row),
      },
    };
    await expect(listingsWith(prisma).reactivate('l1')).rejects.toThrow(
      new ConflictException('Only inactive listings can be reactivated'),
    );
  });

  it('reports not found for a missing or deleted listing', async () => {
    const prisma = {
      listing: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    await expect(listingsWith(prisma).deactivate('l1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists every non-deleted status unless one is requested', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = listingsWith({ listing: { findMany } });
    await service.adminList({ page: 1, limit: 20 });
    expect(findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
    await service.adminList({ page: 1, limit: 20, status: 'ACTIVE' });
    expect(findMany.mock.calls[1][0].where).toEqual({
      deletedAt: null,
      status: 'ACTIVE',
    });
  });
});

describe('admin summary', () => {
  const service = (permission: object | null) =>
    new AdminService(
      {
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ adminPermission: permission }),
        },
        listing: {
          groupBy: jest.fn().mockResolvedValue([
            { status: 'PENDING_APPROVAL', _count: { _all: 2 } },
            { status: 'ACTIVE', _count: { _all: 5 } },
          ]),
        },
        rentalRequest: {
          count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1),
        },
        complaint: { count: jest.fn().mockResolvedValue(3) },
      } as never,
      {
        counts: jest.fn().mockResolvedValue({ upcoming: 2, refundDue: 1 }),
      } as never,
    );

  it('rejects callers without any admin permission', async () => {
    await expect(service(null).summary('auth-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns only the sections the caller may manage', async () => {
    await expect(
      service({ canApproveListings: false, canManageComplaints: true }).summary(
        'a',
      ),
    ).resolves.toEqual({
      complaints: { open: 3 },
    });
    await expect(
      service({ canApproveListings: true, canManageComplaints: false }).summary(
        'a',
      ),
    ).resolves.toEqual({
      listings: { pending: 2, active: 5, inactive: 0 },
      requests: { open: 4, unassigned: 1 },
      bookings: { upcoming: 2, refundDue: 1 },
    });
  });
});
