import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AdminActivityService } from './admin-activity.service';
import type {
  CreatePropertyCommissionDto,
  PropertyCommissionQueryDto,
  UpdatePropertyCommissionDto,
} from './dto/property-commission.dto';
import { pageResult, pageWindow, type PaginationQuery } from '../../common/pagination';

@Injectable()
export class PropertyCommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: AdminActivityService,
  ) {}

  async list(query: PropertyCommissionQueryDto) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.feeType ? { feeType: query.feeType } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.listingId ? { listingId: query.listingId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.propertyCommission.count({ where }),
      this.prisma.propertyCommission.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          owner: { select: { id: true, email: true, phone: true } },
          listing: {
            select: {
              id: true,
              reference: true,
              title: true,
              areaText: true,
              propertyType: true,
              monthlyRent: true,
            },
          },
          match: {
            select: {
              id: true,
              status: true,
              score: true,
              request: {
                select: {
                  id: true,
                  renter: { select: { email: true, phone: true } },
                },
              },
            },
          },
        },
        ...pageWindow(query),
      }),
    ]);

    return {
      data: rows,
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      total,
      hasNextPage: (query.page ?? 1) * (query.limit ?? 25) < total,
    };
  }

  async getById(id: string) {
    const commission = await this.prisma.propertyCommission.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, phone: true } },
        listing: true,
        match: {
          include: {
            request: {
              include: {
                renter: { select: { id: true, email: true, phone: true } },
              },
            },
          },
        },
      },
    });
    if (!commission) throw new NotFoundException('Commission record not found');
    return commission;
  }

  async create(authUserId: string, dto: CreatePropertyCommissionDto) {
    const admin = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!admin) throw new NotFoundException('Admin account not found');

    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { id: true, ownerId: true, monthlyRent: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    if (dto.matchId) {
      const match = await this.prisma.match.findUnique({
        where: { id: dto.matchId },
        select: { id: true, listingId: true, commission: { select: { id: true } } },
      });
      if (!match) throw new NotFoundException('Match not found');
      if (match.listingId !== listing.id)
        throw new BadRequestException('Match does not belong to this listing');
      if (match.commission)
        throw new ConflictException('A commission record already exists for this match');
    }

    const feeType = dto.feeType ?? 'COMMISSION';
    let agreedRent: number | null = null;
    let ratePercent: number | null = null;
    let amount = dto.amount;

    if (feeType === 'COMMISSION') {
      agreedRent = dto.agreedRent ?? listing.monthlyRent;
      ratePercent = dto.ratePercent ?? 30;
      if (amount === undefined) {
        amount = Math.round((agreedRent * ratePercent) / 100);
      }
    } else {
      // LISTING_FEE
      amount = dto.amount ?? 0;
    }

    const now = new Date();
    const commission = await this.prisma.propertyCommission.create({
      data: {
        listingId: listing.id,
        ownerId: listing.ownerId,
        matchId: dto.matchId ?? null,
        feeType,
        agreedRent,
        ratePercent,
        amount,
        status: dto.status ?? 'DUE',
        note: dto.note?.trim() || null,
        paymentReference: dto.paymentReference?.trim() || null,
        invoicedAt: dto.status === 'INVOICED' ? now : null,
        paidAt: dto.status === 'PAID' ? now : null,
        createdById: admin.id,
      },
    });

    await this.activity.record(
      authUserId,
      feeType === 'COMMISSION' ? 'PROPERTY_COMMISSION_CREATED' : 'LISTING_FEE_CREATED',
      'PROPERTY_COMMISSION',
      commission.id,
      `Created ${feeType.toLowerCase()} of LKR ${amount} for listing ${listing.id}`,
    );

    return commission;
  }

  async update(authUserId: string, id: string, dto: UpdatePropertyCommissionDto) {
    const admin = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!admin) throw new NotFoundException('Admin account not found');

    const existing = await this.prisma.propertyCommission.findUnique({
      where: { id },
      include: { listing: { select: { monthlyRent: true } } },
    });
    if (!existing) throw new NotFoundException('Commission record not found');

    let amount = dto.amount;
    let agreedRent = dto.agreedRent !== undefined ? dto.agreedRent : existing.agreedRent;
    let ratePercent = dto.ratePercent !== undefined ? dto.ratePercent : existing.ratePercent;

    if (amount === undefined && (dto.agreedRent !== undefined || dto.ratePercent !== undefined)) {
      if (existing.feeType === 'COMMISSION') {
        const rent = agreedRent ?? existing.listing.monthlyRent;
        const rate = ratePercent ?? 30;
        amount = Math.round((rent * rate) / 100);
      }
    }

    const now = new Date();
    const updated = await this.prisma.propertyCommission.update({
      where: { id },
      data: {
        ...(agreedRent !== undefined ? { agreedRent } : {}),
        ...(ratePercent !== undefined ? { ratePercent } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.paymentReference !== undefined ? { paymentReference: dto.paymentReference?.trim() || null } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        ...(dto.status === 'INVOICED' && !existing.invoicedAt ? { invoicedAt: now } : {}),
        ...(dto.status === 'PAID' && !existing.paidAt ? { paidAt: now } : {}),
        updatedById: admin.id,
      },
    });

    await this.activity.record(
      authUserId,
      'PROPERTY_COMMISSION_UPDATED',
      'PROPERTY_COMMISSION',
      id,
      `Updated commission ${id}: status=${updated.status}, amount=LKR ${updated.amount}`,
    );

    return updated;
  }

  async listForOwner(authUserId: string, query: PaginationQuery) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const where = { ownerId: user.id };
    const [total, rows] = await Promise.all([
      this.prisma.propertyCommission.count({ where }),
      this.prisma.propertyCommission.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          listing: {
            select: {
              id: true,
              reference: true,
              title: true,
              areaText: true,
              propertyType: true,
            },
          },
        },
        ...pageWindow(query),
      }),
    ]);

    return {
      data: rows,
      page: query.page ?? 1,
      limit: query.limit ?? 25,
      total,
      hasNextPage: (query.page ?? 1) * (query.limit ?? 25) < total,
    };
  }
}

