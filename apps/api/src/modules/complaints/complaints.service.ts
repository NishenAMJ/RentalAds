import {
  PaginationQuery,
  pageWindow,
  pageResult,
} from '../../common/pagination';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import type { CreateDisputeDto } from './dto/create-complaint.dto';
import type { UpdateComplaintDto } from './dto/update-complaint.dto';
import { NotifyService } from '../notifications/notify.service';
import { AdminActivityService } from '../admin/admin-activity.service';

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private readonly notify: NotifyService,
    private readonly activity: AdminActivityService,
  ) {}

  async create(dto: CreateComplaintDto, reporterId?: string) {
    const { website, ...data } = dto;
    if (website !== undefined && website !== '') {
      throw new BadRequestException('Unable to submit complaint.');
    }
    return this.prisma.complaint.create({
      data: { ...data, ...(reporterId ? { reporterId } : {}) },
    });
  }

  async findAll(query: PaginationQuery) {
    const rows = await this.prisma.complaint.findMany({
      include: {
        reporter: { select: { email: true } },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            renterId: true,
            listing: { select: { ownerId: true, title: true, areaText: true } },
          },
        },
        resolvedBy: { select: { email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }

  async createDispute(authUserId: string, dto: CreateDisputeDto) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('User account is not ready');
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        renterId: true,
        paidAt: true,
        listingId: true,
        listing: { select: { ownerId: true, title: true, areaText: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const parties = [...new Set([booking.renterId, booking.listing.ownerId])];
    if (!parties.includes(user.id))
      throw new ForbiddenException(
        'Only people on this booking can open a dispute',
      );
    if (!booking.paidAt)
      throw new BadRequestException(
        'A dispute can only be opened for a paid booking',
      );
    try {
      const dispute = await this.prisma.complaint.create({
        data: {
          bookingId: booking.id,
          disputeType: dto.issueType,
          targetType: 'LISTING',
          targetId: booking.listingId,
          reason: dto.reason.trim(),
          reporterId: user.id,
        },
        select: {
          id: true,
          bookingId: true,
          disputeType: true,
          reason: true,
          status: true,
          createdAt: true,
        },
      });
      await this.notify.send(
        parties.map((partyId) => ({
          userId: partyId,
          type: 'DISPUTE_OPENED' as const,
          title: 'A booking dispute was opened',
          message: `${booking.listing.title ?? booking.listing.areaText}: ${dto.issueType.toLowerCase().replaceAll('_', ' ')}. Our team will review the case.`,
          link: '/bookings',
        })),
      );
      return dispute;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'A dispute has already been opened for this booking',
        );
      throw error;
    }
  }

  async myDispute(authUserId: string, bookingId: string) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('User account is not ready');
    const dispute = await this.prisma.complaint.findUnique({
      where: { bookingId },
      select: {
        id: true,
        bookingId: true,
        disputeType: true,
        reason: true,
        status: true,
        resolution: true,
        resolvedAt: true,
        createdAt: true,
        booking: {
          select: { renterId: true, listing: { select: { ownerId: true } } },
        },
      },
    });
    if (!dispute) return null;
    if (!dispute.booking)
      throw new NotFoundException('This case is not linked to a booking');
    if (
      dispute.booking.renterId !== user.id &&
      dispute.booking.listing.ownerId !== user.id
    )
      throw new ForbiddenException(
        'Only people on this booking can view its dispute',
      );
    return {
      id: dispute.id,
      bookingId: dispute.bookingId,
      disputeType: dispute.disputeType,
      reason: dispute.reason,
      status: dispute.status,
      resolution: dispute.resolution,
      resolvedAt: dispute.resolvedAt,
      createdAt: dispute.createdAt,
    };
  }

  async updateStatus(id: string, dto: UpdateComplaintDto, authUserId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            renterId: true,
            listing: { select: { ownerId: true, title: true, areaText: true } },
          },
        },
      },
    });
    if (!complaint) throw new NotFoundException('Complaint not found');
    if (complaint.status === 'RESOLVED' && dto.status !== 'RESOLVED')
      throw new ConflictException(
        'Resolved cases cannot be reopened; create a new report if needed',
      );
    const resolution = dto.resolution?.trim() || complaint.resolution;
    if (dto.status === 'RESOLVED' && !resolution)
      throw new BadRequestException(
        'Add a resolution summary before resolving this case',
      );
    const admin = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.adminNotes !== undefined
          ? { adminNotes: dto.adminNotes.trim() || null }
          : {}),
        ...(resolution ? { resolution } : {}),
        ...(dto.status === 'RESOLVED'
          ? {
              resolvedAt: complaint.resolvedAt ?? new Date(),
              resolvedById: complaint.resolvedById ?? admin?.id,
            }
          : {}),
      },
    });
    await this.activity.record(
      authUserId,
      'COMPLAINT_UPDATED',
      'COMPLAINT',
      id,
      `Case status changed to ${dto.status}`,
    );
    const resolutionChanged = Boolean(
      dto.resolution?.trim() && dto.resolution.trim() !== complaint.resolution,
    );
    if (
      complaint.booking &&
      (dto.status !== complaint.status || resolutionChanged)
    ) {
      const parties = [
        ...new Set([
          complaint.booking.renterId,
          complaint.booking.listing.ownerId,
        ]),
      ];
      await this.notify.send(
        parties.map((userId) => ({
          userId,
          type: 'DISPUTE_UPDATED' as const,
          title:
            dto.status === 'RESOLVED'
              ? 'Booking dispute resolved'
              : 'Booking dispute updated',
          message: `${complaint.booking?.listing.title ?? complaint.booking?.listing.areaText}: case marked ${dto.status.toLowerCase()}.${dto.status === 'RESOLVED' && resolution ? ` Resolution: ${resolution}` : ''}`,
          link: '/bookings',
        })),
      );
    }
    return this.prisma.complaint.findUnique({
      where: { id: updated.id },
      include: {
        reporter: { select: { email: true } },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            renterId: true,
            listing: { select: { ownerId: true, title: true, areaText: true } },
          },
        },
        resolvedBy: { select: { email: true } },
      },
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
