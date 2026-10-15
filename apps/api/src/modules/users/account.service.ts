import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
    const [listings, rentalRequests, complaints, notifications] =
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
      ]);
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      listings,
      // Internal admin notes and assignments are not the renter's data.
      rentalRequests: rentalRequests.map(forRenter),
      complaints,
      notifications,
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
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: `deleted+${user.id}@deleted.invalid`,
          authUserId: `deleted:${user.id}`,
          phone: null,
        },
      }),
    ]);
    return {
      deleted: true,
      signInRemoved: await this.removeSignIn(authUser.authUserId),
    };
  }

  /** Deletes the Supabase identity when a service-role key is configured. */
  private async removeSignIn(authUserId: string): Promise<boolean> {
    const url =
      this.config.get<string>('SUPABASE_URL') ??
      this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return false;
    try {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await admin.auth.admin.deleteUser(authUserId);
      if (error) throw error;
      return true;
    } catch (cause) {
      // Personal data is already gone; surface the gap for operators without failing the user.
      this.logger.error(
        `Could not delete sign-in identity for a removed account: ${String(cause)}`,
      );
      return false;
    }
  }
}
