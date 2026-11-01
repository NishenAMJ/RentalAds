import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private bookings: BookingsService,
  ) {}

  async grantPermission(dto: GrantPermissionDto) {
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser)
      throw new NotFoundException('No user found with that email');

    const flags = dto;

    return this.prisma.adminPermission.upsert({
      where: { userId: targetUser.id },
      create: {
        userId: targetUser.id,
        canApproveListings: flags.canApproveListings ?? false,
        canManageAdmins: flags.canManageAdmins ?? false,
        canManageComplaints: flags.canManageComplaints ?? false,
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
      },
    });
  }

  /** Headline counts for the admin overview, limited to the areas the caller may manage. */
  async summary(authUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
      include: { adminPermission: true },
    });
    const permission = user?.adminPermission;
    if (!permission) throw new ForbiddenException('Admin permission required');
    const [listings, requests, complaints, bookings] = await Promise.all([
      permission.canApproveListings ? this.listingCounts() : undefined,
      permission.canApproveListings ? this.requestCounts() : undefined,
      permission.canManageComplaints
        ? this.prisma.complaint.count({ where: { status: 'OPEN' } })
        : undefined,
      permission.canApproveListings ? this.bookings.counts() : undefined,
    ]);
    return {
      ...(listings ? { listings } : {}),
      ...(requests ? { requests } : {}),
      ...(bookings ? { bookings } : {}),
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
