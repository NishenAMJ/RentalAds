import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { UsersService } from './users.service';

describe('UsersService identity conflicts', () => {
  const identity = { authUserId: 'verified-id', email: 'owner@pilot.test' };
  const conflict = new Prisma.PrismaClientKnownRequestError(
    'Unique constraint',
    { code: 'P2002', clientVersion: '5.22.0' },
  );

  it('returns the winner of a concurrent first request', async () => {
    const existing = { id: 'database-id', ...identity, role: 'ADMIN' };
    const prisma = {
      user: {
        upsert: jest.fn().mockRejectedValue(conflict),
        findUnique: jest.fn().mockResolvedValue(existing),
      },
    };
    const service = new UsersService(prisma as unknown as PrismaService);
    await expect(service.findOrCreate(identity)).resolves.toEqual(existing);
  });

  it('does not link a different identity by matching email', async () => {
    const prisma = {
      user: {
        upsert: jest.fn().mockRejectedValue(conflict),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new UsersService(prisma as unknown as PrismaService);
    await expect(service.findOrCreate(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('preserves an existing role when the user submits a listing', async () => {
    const existing = { id: 'database-id', ...identity, role: 'RENTER' };
    const prisma = { user: { upsert: jest.fn().mockResolvedValue(existing) } };
    const service = new UsersService(prisma as unknown as PrismaService);
    await expect(service.findOrCreate(identity, 'OWNER')).resolves.toEqual(
      existing,
    );
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { email: identity.email } }),
    );
  });
});
