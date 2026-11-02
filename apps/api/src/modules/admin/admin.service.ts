import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { BookingsService } from '../bookings/bookings.service';
import { AdminActivityService } from './admin-activity.service';
import type { AdminUsersQuery } from './dto/admin-users.query';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { pageResult, pageWindow } from '../../common/pagination';
import { ConflictException } from '@nestjs/common';
import type { UpdateOwnerVerificationDto } from './dto/update-owner-verification.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private bookings: BookingsService,
    private activity: AdminActivityService,
  ) {}

  async grantPermission(authUserId: string, dto: GrantPermissionDto) {
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser)
      throw new NotFoundException('No user found with that email');

    const flags = dto;

    const result = await this.prisma.adminPermission.upsert({
      where: { userId: targetUser.id },
      create: {
        userId: targetUser.id,
        canApproveListings: flags.canApproveListings ?? false,
        canManageAdmins: flags.canManageAdmins ?? false,
        canManageComplaints: flags.canManageComplaints ?? false,
        canManagePayouts: flags.canManagePayouts ?? false,
      },
      update: {
        ...(flags.canApproveListings !== undefined
          ? { canApproveListings: flags.canApproveListings }
          : {}),
        ...(flags.canManageAdmins !== undefined
          ? { canManageAdmins: flags.canManageAdmins }
          : {}),
        ...(flags.canManageComplaints !== undefined
          ? { canManageComplaints: flags.canManageComplaints }
          : {}),
        ...(flags.canManagePayouts !== undefined
          ? { canManagePayouts: flags.canManagePayouts }
          : {}),
      },
    });
    await this.activity.record(
      authUserId,
      'ADMIN_PERMISSIONS_CHANGED',
      'USER',
      targetUser.id,
      'Admin permissions changed',
    );
    return result;
  }

  async listUsers(query: AdminUsersQuery) {
    const search = query.search?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        ...(query.status ? { accountStatus: query.status } : {}),
        ...(query.verificationStatus
          ? { ownerVerificationStatus: query.verificationStatus }
          : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        accountStatus: true,
        suspendedAt: true,
        suspensionReason: true,
        ownerVerificationStatus: true,
        ownerVerificationRequestedAt: true,
        ownerVerificationReviewedAt: true,
        ownerVerificationNote: true,
        createdAt: true,
        adminPermission: {
          select: {
            canApproveListings: true,
            canManageAdmins: true,
            canManageComplaints: true,
            canManagePayouts: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(users, query);
  }

  async updateUserStatus(
    authUserId: string,
    id: string,
    dto: UpdateUserStatusDto,
  ) {
    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { authUserId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id },
        include: { adminPermission: true },
      }),
    ]);
    if (!actor) throw new ForbiddenException('Admin account required');
    if (!target) throw new NotFoundException('User not found');
    if (target.id === actor.id)
      throw new ConflictException('You cannot change your own account status');
    if (target.accountStatus === dto.status)
      throw new ConflictException(
        `This account is already ${dto.status.toLowerCase()}`,
      );
    const hasAdminAccess =
      target.adminPermission &&
      Object.values(target.adminPermission).some((value) => value === true);
    if (dto.status === 'SUSPENDED' && hasAdminAccess)
      throw new ConflictException(
        'Remove this user’s admin permissions before suspending the account',
      );

    const updated = await this.prisma.user.update({
      where: { id },
      data:
        dto.status === 'SUSPENDED'
          ? {
              accountStatus: 'SUSPENDED',
              suspendedAt: new Date(),
              suspensionReason: dto.reason.trim(),
            }
          : {
              accountStatus: 'ACTIVE',
              suspendedAt: null,
              suspensionReason: null,
            },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });
    await this.activity.record(
      authUserId,
      dto.status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_RESTORED',
      'USER',
      id,
      dto.status === 'SUSPENDED'
        ? 'User account suspended'
        : 'User account restored',
    );
    return updated;
  }

  async updateOwnerVerification(
    authUserId: string,
    id: string,
    dto: UpdateOwnerVerificationDto,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (dto.status === 'NOT_REQUESTED')
      throw new ConflictException(
        'Verification cannot be reset to NOT_REQUESTED',
      );
    if (target.ownerVerificationStatus !== 'REQUESTED')
      throw new ConflictException(
        'The user must request verification before review',
      );
    if (target.ownerVerificationStatus === dto.status)
      throw new ConflictException(
        `This account is already ${dto.status.toLowerCase()}`,
      );

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ownerVerificationStatus: dto.status,
        ownerVerificationReviewedAt: new Date(),
        ownerVerificationNote: dto.note.trim(),
      },
      select: {
        id: true,
        email: true,
        ownerVerificationStatus: true,
        ownerVerificationRequestedAt: true,
        ownerVerificationReviewedAt: true,
        ownerVerificationNote: true,
      },
    });
    await this.activity.record(
      authUserId,
      `OWNER_VERIFICATION_${dto.status}`,
      'USER',
      id,
      `Owner verification marked ${dto.status.toLowerCase()}`,
    );
    return updated;
  }

  /** Headline counts for the admin overview, limited to the areas the caller may manage. */
  async summary(authUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
      include: { adminPermission: true },
    });
    const permission = user?.adminPermission;
    if (!permission) throw new ForbiddenException('Admin permission required');
    const [listings, requests, complaints, bookings, payouts] =
      await Promise.all([
        permission.canApproveListings ? this.listingCounts() : undefined,
        permission.canApproveListings ? this.requestCounts() : undefined,
        permission.canManageComplaints
          ? this.prisma.complaint.count({ where: { status: 'OPEN' } })
          : undefined,
        permission.canApproveListings ? this.bookings.counts() : undefined,
        permission.canManagePayouts
          ? this.prisma.ownerPayout.aggregate({
              where: { status: 'DUE' },
              _count: { _all: true },
              _sum: { amount: true },
            })
          : undefined,
      ]);
    return {
      ...(listings ? { listings } : {}),
      ...(requests ? { requests } : {}),
      ...(bookings ? { bookings } : {}),
      ...(payouts
        ? {
            payouts: {
              dueCount: payouts._count._all,
              dueAmount: payouts._sum.amount ?? 0,
            },
          }
        : {}),
      ...(complaints !== undefined ? { complaints: { open: complaints } } : {}),
    };
  }

  private async listingCounts() {
    const rows = await this.prisma.listing.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const count = (status: string) =>
      rows.find((row) => row.status === status)?._count._all ?? 0;
    return {
      pending: count('PENDING_APPROVAL'),
      active: count('ACTIVE'),
      inactive: count('INACTIVE'),
    };
  }

  private async requestCounts() {
    const open = { status: 'OPEN' as const, deletedAt: null };
    const [total, unassigned] = await Promise.all([
      this.prisma.rentalRequest.count({ where: open }),
      this.prisma.rentalRequest.count({
        where: { ...open, assignedAdminId: null },
      }),
    ]);
    return { open: total, unassigned };
  }
}
