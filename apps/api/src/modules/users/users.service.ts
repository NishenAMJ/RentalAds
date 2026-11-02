import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async profile(authUser: AuthenticatedUser) {
    const user = await this.findOrCreate(authUser);
    const permissions = await this.prisma.adminPermission.findUnique({
      where: { userId: user.id },
      select: {
        canApproveListings: true,
        canManageAdmins: true,
        canManageComplaints: true,
        canManagePayouts: true,
      },
    });
    return { ...user, adminPermission: permissions };
  }

  async requestOwnerVerification(authUser: AuthenticatedUser) {
    const user = await this.findOrCreate(authUser);
    if (user.ownerVerificationStatus === 'REQUESTED')
      throw new ConflictException(
        'Your verification request is already pending',
      );
    if (user.ownerVerificationStatus === 'VERIFIED')
      throw new ConflictException('Your account is already verified');
    if (user.accountStatus === 'SUSPENDED')
      throw new BadRequestException(
        'Suspended accounts cannot request verification',
      );
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ownerVerificationStatus: 'REQUESTED',
        ownerVerificationRequestedAt: new Date(),
        ownerVerificationReviewedAt: null,
        ownerVerificationNote: null,
      },
      select: {
        ownerVerificationStatus: true,
        ownerVerificationRequestedAt: true,
        ownerVerificationReviewedAt: true,
        ownerVerificationNote: true,
      },
    });
  }
  async findOrCreate(
    authUser: AuthenticatedUser,
    defaultRole: UserRole = 'RENTER',
  ) {
    if (!authUser.email)
      throw new UnauthorizedException('An email address is required');
    try {
      return await this.prisma.user.upsert({
        where: { authUserId: authUser.authUserId },
        update: {},
        create: {
          authUserId: authUser.authUserId,
          email: authUser.email,
          role: defaultRole,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // A concurrent first request may have created the same identity.
        const existing = await this.prisma.user.findUnique({
          where: { authUserId: authUser.authUserId },
        });
        if (existing) return existing;
        throw new ConflictException(
          'This email is already linked to another account',
        );
      }
      throw error;
    }
  }
}
