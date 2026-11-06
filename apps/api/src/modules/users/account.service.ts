import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../../common/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { forRenter } from '../RequestsModule/request-view';

const REMOVED = '[removed]';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async requireUser(authUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId: authUser.authUserId },
      include: { adminPermission: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  /** Everything we hold about the caller, for download. Internal admin notes are excluded. */
  async exportData(authUser: AuthenticatedUser) {
    const user = await this.requireUser(authUser);
    const [listings, rentalRequests, complaints, notifications, ratings] =
      await Promise.all([
        this.prisma.listing.findMany({
          where: { ownerId: user.id },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.rentalRequest.findMany({
          where: { renterId: user.id },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.complaint.findMany({
          where: { reporterId: user.id },
          select: {
            id: true,
            targetType: true,
            targetId: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.bookingReview.findMany({
          where: { reviewerId: user.id },
          select: { bookingId: true, rating: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
        ownerVerificationStatus: user.ownerVerificationStatus,
        ownerVerificationRequestedAt: user.ownerVerificationRequestedAt,
        ownerVerificationReviewedAt: user.ownerVerificationReviewedAt,
        ownerVerificationNote: user.ownerVerificationNote,
      },
      listings,
      // Internal admin notes and assignments are not the renter's data.
      rentalRequests: rentalRequests.map(forRenter),
      complaints,
      notifications,
      ratings,
    };
  }

  /**
   * Removes the caller's personal data. Listings and requests are hidden and
   * stripped of contact details, matches are invalidated, reports are detached
   * and the account row is anonymised so the old sign-in no longer maps to it.
   */
  async deleteAccount(authUser: AuthenticatedUser) {
    const user = await this.requireUser(authUser);
    if (user.adminPermission)
      throw new ConflictException(
        'Administrator accounts cannot be deleted here. Ask another administrator to remove admin access first.',
      );
    // Remove sign-in first. If Supabase is unavailable, leave the account intact
    // so the user can retry instead of anonymising their record while preserving login.
    await this.removeSignIn(authUser.authUserId);
    const now = new Date();
    const reason = 'Account deleted by user';
    await this.prisma.$transaction([
      this.prisma.match.updateMany({
        where: {
          invalidatedAt: null,
          OR: [
            { listing: { ownerId: user.id } },
            { request: { renterId: user.id } },
          ],
        },
        data: { invalidatedAt: now, invalidationReason: reason },
      }),
      this.prisma.listing.updateMany({
        where: { ownerId: user.id },
        data: { ownerContact: REMOVED, photoUrls: [] },
      }),
      this.prisma.listing.updateMany({
        where: { ownerId: user.id, deletedAt: null },
        data: { deletedAt: now, deletionReason: reason },
      }),
      this.prisma.rentalRequest.updateMany({
        where: { renterId: user.id },
        data: { renterContact: REMOVED },
      }),
      this.prisma.rentalRequest.updateMany({
        where: { renterId: user.id, deletedAt: null },
        data: { deletedAt: now, deletionReason: reason },
      }),
      this.prisma.complaint.updateMany({
        where: { reporterId: user.id },
        data: { reporterId: null },
      }),
      this.prisma.notification.deleteMany({ where: { userId: user.id } }),
      this.prisma.bookingReview.deleteMany({ where: { reviewerId: user.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${user.id}@deleted.invalid`,
          authUserId: `deleted:${user.id}`,
          phone: null,
          ownerVerificationStatus: 'NOT_REQUESTED',
          ownerVerificationRequestedAt: null,
          ownerVerificationReviewedAt: null,
          ownerVerificationNote: null,
        },
      }),
    ]);
    return { deleted: true, signInRemoved: true };
  }

  /** Deletes the Supabase identity; account deletion must not succeed without it. */
  private async removeSignIn(authUserId: string): Promise<void> {
    const url =
      this.config.get<string>('SUPABASE_URL') ??
      this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey)
      throw new ServiceUnavailableException(
        'Account deletion is not available right now. Please contact support.',
      );
    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) throw error;
    } catch (cause) {
      this.logger.error(
        `Could not delete sign-in identity for account deletion: ${String(cause)}`,
      );
      throw new ServiceUnavailableException(
        'We could not remove your sign-in. Your account has not been deleted; please try again later.',
      );
    }
  }
}
