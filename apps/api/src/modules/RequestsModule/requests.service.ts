import {
  PaginationQuery,
  pageWindow,
  pageResult,
} from '../../common/pagination';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type { CreateRequestDto } from './create-request.dto';
import { forRenter } from './request-view';
import type {
  AdminRequestQuery,
  UpdateRequestWorkDto,
} from './request-work.dto';

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService) {}

  async create(renterId: string, dto: CreateRequestDto) {
    if (dto.budgetMin != null && dto.budgetMin > dto.budgetMax) {
      throw new BadRequestException(
        'Minimum budget cannot exceed maximum budget',
      );
    }
    return forRenter(
      await this.prisma.rentalRequest.create({
        data: { ...dto, renterId },
      }),
    );
  }

  // Renter's own requests only — never another renter's.
  async findMine(renterId: string, query: PaginationQuery) {
    const rows = await this.prisma.rentalRequest.findMany({
      where: { renterId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows.map(forRenter), query);
  }

  // Admin-only. Returns everything, including renterContact — this is
  // intentional, since admins need it to relay matches via WhatsApp.
  async findAllForAdmin(query: AdminRequestQuery, adminAuthUserId?: string) {
    const where: Prisma.RentalRequestWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    if (query.assigned === 'unassigned') where.assignedAdminId = null;
    if (query.assigned === 'me') {
      const admin = adminAuthUserId
        ? await this.prisma.user.findUnique({
            where: { authUserId: adminAuthUserId },
          })
        : null;
      // An unknown caller can never own a request, so the queue is simply empty.
      where.assignedAdminId = admin?.id ?? '';
    }
    const rows = await this.prisma.rentalRequest.findMany({
      where,
      include: { assignedAdmin: { select: { id: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }

  /** Assign, annotate or schedule a follow-up for a request. Internal only. */
  async updateWork(
    adminAuthUserId: string,
    requestId: string,
    dto: UpdateRequestWorkDto,
  ) {
    if (dto.assignToMe && dto.unassign)
      throw new BadRequestException('Choose either assign or unassign');
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { authUserId: adminAuthUserId },
    });
    const data: Prisma.RentalRequestUncheckedUpdateInput = {};
    if (dto.assignToMe) {
      data.assignedAdminId = admin.id;
      data.assignedAt = new Date();
    }
    if (dto.unassign) {
      data.assignedAdminId = null;
      data.assignedAt = null;
    }
    if (dto.adminNotes !== undefined)
      data.adminNotes = dto.adminNotes.trim() || null;
    if (dto.followUpAt !== undefined)
      data.followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : null;
    if (!Object.keys(data).length)
      throw new BadRequestException('Nothing to update');
    return this.prisma.rentalRequest.update({
      where: { id: requestId },
      data,
      include: { assignedAdmin: { select: { id: true, email: true } } },
    });
  }

  async close(renterId: string, requestId: string) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    if (request.renterId !== renterId)
      throw new ForbiddenException('Not your request');

    return forRenter(
      await this.prisma.rentalRequest.update({
        where: { id: requestId },
        data: { status: 'CLOSED' },
      }),
    );
  }
  async remove(
    requestId: string,
    actorId: string,
    admin = false,
    reason?: string,
  ) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    if (!admin && request.renterId !== actorId)
      throw new ForbiddenException('Not your request');
    if (admin && !reason?.trim())
      throw new BadRequestException('A deletion reason is required');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.rentalRequest.update({
        where: { id: requestId },
        data: {
          deletedAt: now,
          deletedByAdminId: admin ? actorId : null,
          deletionReason: admin ? reason!.trim() : null,
        },
      }),
      this.prisma.match.updateMany({
        where: { requestId, invalidatedAt: null },
        data: { invalidatedAt: now, invalidationReason: 'Request deleted' },
      }),
      ...(admin
        ? [
            this.prisma.notification.create({
              data: {
                userId: request.renterId,
                type: 'ADMIN_DELETION',
                title: 'Your property request was removed',
                message: `Your request for ${request.areaText} was removed. Reason: ${reason!.trim()}`,
              },
            }),
          ]
        : []),
    ]);
    return { id: requestId, deletedAt: now };
  }
  async removeAdmin(authUserId: string, id: string, reason: string) {
    const admin = await this.prisma.user.findUniqueOrThrow({
      where: { authUserId },
    });
    return this.remove(id, admin.id, true, reason);
  }
}
