/// <reference types="jest" />
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountService } from '../src/modules/users/account.service';

const deleteUser = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { deleteUser } } }),
}));

const authUser = { authUserId: 'auth-1', email: 'person@example.test' };
const account = {
  id: 'u1',
  email: authUser.email,
  role: 'RENTER',
  phone: null,
};

function build(overrides: {
  user?: object | null;
  env?: Record<string, string>;
}) {
  const op = (name: string) => jest.fn().mockReturnValue(name);
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.user === undefined
            ? { ...account, adminPermission: null }
            : overrides.user,
        ),
      update: op('user.update'),
    },
    listing: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: op('listing.updateMany'),
    },
    rentalRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: op('request.updateMany'),
    },
    complaint: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: op('complaint.updateMany'),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: op('notification.deleteMany'),
    },
    bookingReview: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: op('bookingReview.deleteMany'),
    },
    match: { updateMany: op('match.updateMany') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const config = { get: (key: string) => overrides.env?.[key] };
  return {
    prisma,
    service: new AccountService(prisma as never, config as never),
  };
}

describe('AccountService.exportData', () => {
  it('returns the caller’s data and never internal admin notes', async () => {
    const { prisma, service } = build({});
    const result = await service.exportData(authUser);
    expect(result.account).toMatchObject({ id: 'u1', email: authUser.email });
    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'u1' } }),
    );
    const complaintQuery = prisma.complaint.findMany.mock.calls[0] as [
      { select: Record<string, boolean> },
    ];
    expect(complaintQuery[0].select).not.toHaveProperty('adminNotes');
    expect(prisma.bookingReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reviewerId: 'u1' } }),
    );
  });

  it('fails for an unknown account', async () => {
    const { service } = build({ user: null });
    await expect(service.exportData(authUser)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('AccountService.deleteAccount', () => {
  beforeEach(() => deleteUser.mockReset());

  it('scrubs personal data in one transaction and anonymises the account', async () => {
    deleteUser.mockResolvedValue({ error: null });
    const { prisma, service } = build({
      env: {
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
      },
    });
    const result = await service.deleteAccount(authUser);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ownerContact: '[removed]', photoUrls: [] },
      }),
    );
    expect(prisma.rentalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { renterContact: '[removed]' } }),
    );
    expect(prisma.complaint.updateMany).toHaveBeenCalledWith({
      where: { reporterId: 'u1' },
      data: { reporterId: null },
    });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.bookingReview.deleteMany).toHaveBeenCalledWith({
      where: { reviewerId: 'u1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        email: 'deleted+u1@deleted.invalid',
        authUserId: 'deleted:u1',
        phone: null,
        ownerVerificationStatus: 'NOT_REQUESTED',
        ownerVerificationRequestedAt: null,
        ownerVerificationReviewedAt: null,
        ownerVerificationNote: null,
      },
    });
    expect(result).toEqual({ deleted: true, signInRemoved: true });
  });

  it('does not alter account data when identity removal is not configured', async () => {
    const { prisma, service } = build({});
    await expect(service.deleteAccount(authUser)).rejects.toThrow(
      'Account deletion is not available right now',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('also removes the sign-in identity when a service key is configured', async () => {
    deleteUser.mockResolvedValue({ error: null });
    const { service } = build({
      env: {
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
      },
    });
    await expect(service.deleteAccount(authUser)).resolves.toEqual({
      deleted: true,
      signInRemoved: true,
    });
    expect(deleteUser).toHaveBeenCalledWith('auth-1');
  });

  it('does not alter account data when the identity provider call fails', async () => {
    deleteUser.mockResolvedValue({ error: new Error('boom') });
    const { prisma, service } = build({
      env: {
        SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
      },
    });
    await expect(service.deleteAccount(authUser)).rejects.toThrow(
      'We could not remove your sign-in',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to delete administrator accounts', async () => {
    const { prisma, service } = build({
      user: { ...account, adminPermission: { canApproveListings: true } },
    });
    await expect(service.deleteAccount(authUser)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
