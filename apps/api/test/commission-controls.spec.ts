import { ForbiddenException } from '@nestjs/common';
import { CommissionStatus, MatchStatus, PropertyFeeType } from '@prisma/client';
import { AdminPermissionGuard } from '../src/common/guards/admin-permission.guard';
import { MatchingService } from '../src/modules/matching/matching.service';

describe('commission controls', () => {
  it('requires canManageCommissions instead of accepting payout permission', async () => {
    const guard = new AdminPermissionGuard(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            adminPermission: {
              canManagePayouts: true,
              canManageCommissions: false,
            },
          }),
        },
      } as never,
      {
        getAllAndOverride: jest.fn().mockReturnValue('canManageCommissions'),
      } as never,
    );
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: { authUserId: 'admin-auth' } }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('canManageCommissions permission required'),
    );
  });

  it('creates a rented commission in the same transaction as the match update', async () => {
    const match = {
      id: 'match-1',
      requestId: 'request-1',
      invalidatedAt: null,
      listing: { id: 'listing-1', ownerId: 'owner-1', monthlyRent: 100000 },
      commission: null,
    };
    const update = jest
      .fn()
      .mockResolvedValue({ ...match, status: MatchStatus.RENTED });
    const create = jest.fn().mockResolvedValue({ id: 'commission-1' });
    const tx = {
      match: { update },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      propertyCommission: { create },
    };
    const prisma = {
      match: { findUnique: jest.fn().mockResolvedValue(match) },
      rentalRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'request-1',
          deletedAt: null,
          status: 'OPEN',
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new MatchingService(prisma as never);

    await expect(
      service.updateStatus(
        'match-1',
        MatchStatus.RENTED,
        120000,
        25,
        'admin-auth',
      ),
    ).resolves.toMatchObject({ status: MatchStatus.RENTED });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { status: MatchStatus.RENTED },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        matchId: 'match-1',
        listingId: 'listing-1',
        ownerId: 'owner-1',
        feeType: PropertyFeeType.COMMISSION,
        agreedRent: 120000,
        ratePercent: 25,
        amount: 30000,
        status: CommissionStatus.DUE,
        createdById: 'admin-1',
      },
    });
  });
});
