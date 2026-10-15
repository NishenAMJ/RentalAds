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
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { UsersService } from '../users/users.service';
import type { CreateListingDto } from './create-listing.dto';
import { toPublicListing } from './public-listing';
import { SearchListingsQuery } from '../../common/search-area.dto';
import { boundingBox, distanceKm } from '../../common/geography';
import { listingIdentifierWhere } from './listing-identifier';
import { listingFilterWhere, listingOrderBy } from './listing-filters';
import {
  availabilityPolicy,
  cutoffDate,
  freshSince,
  isStale,
} from './availability';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  /** Public visibility: active, not deleted, and availability confirmed recently enough. */
  private publicWhere(now = new Date()) {
    const { staleDays } = availabilityPolicy(this.config);
    return {
      status: 'ACTIVE' as const,
      deletedAt: null,
      AND: [freshSince(cutoffDate(now, staleDays))],
    };
  }
  async create(authUser: AuthenticatedUser, input: CreateListingDto) {
    if (!input.areaText.trim() || !input.ownerContact.trim())
      throw new BadRequestException('Area and owner contact cannot be blank');
    if (!input.keyMoney && input.keyMoneyAmount != null)
      throw new BadRequestException(
        'Key money amount requires key money to be enabled',
      );
    if (input.propertyType === 'APARTMENT' && input.size === 'N_A') {
      throw new BadRequestException('Select an apartment size');
    }
    const owner = await this.users.findOrCreate(authUser, 'OWNER');
    return this.prisma.listing.create({
      data: {
        propertyType: input.propertyType,
        size: input.propertyType === 'HOUSE' ? 'N_A' : input.size,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        parking: input.parking,
        furnishing: input.furnishing,
        areaText: input.areaText.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        mapLink:
          input.latitude != null && input.longitude != null
            ? `https://www.openstreetmap.org/?mlat=${input.latitude}&mlon=${input.longitude}#map=16/${input.latitude}/${input.longitude}`
            : input.mapLink,
        monthlyRent: input.monthlyRent,
        minDurationMonths: input.minDurationMonths,
        keyMoney: input.keyMoney,
        keyMoneyAmount: input.keyMoney ? input.keyMoneyAmount : null,
        ownerContact: input.ownerContact.trim(),
        photoUrls: input.photoUrls ?? [],
        ownerId: owner.id,
        status: 'PENDING_APPROVAL',
      },
    });
  }
  async browse(query: SearchListingsQuery) {
    if (query.searchLatitude !== undefined) return this.browseRadius(query);
    const listings = await this.prisma.listing.findMany({
      where: { ...this.publicWhere(), ...listingFilterWhere(query) },
      orderBy: listingOrderBy(query.sort),
      ...pageWindow(query),
    });
    return pageResult(listings.map(toPublicListing), query);
  }
  private async browseRadius(query: SearchListingsQuery) {
    const {
      searchLatitude: lat,
      searchLongitude: lng,
      searchRadiusKm: radius,
    } = query;
    const { skip, take } = pageWindow(query);
    let cursor: string | undefined;
    let nearest: (ReturnType<typeof toPublicListing> & {
      approximateDistanceKm: number;
    })[] = [];
    while (true) {
      const rows = await this.prisma.listing.findMany({
        where: {
          ...this.publicWhere(),
          ...listingFilterWhere(query),
          ...boundingBox(lat!, lng!, radius!, true),
        },
        orderBy: { id: 'asc' },
        take: 250,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const row of rows) {
        const listing = toPublicListing(row);
        if (!listing.approximateLocation) continue;
        const distance = distanceKm(
          lat!,
          lng!,
          listing.approximateLocation.latitude,
          listing.approximateLocation.longitude,
        );
        if (distance <= radius!)
          nearest.push({ ...listing, approximateDistanceKm: distance });
      }
      nearest.sort(
        (a, b) =>
          a.approximateDistanceKm - b.approximateDistanceKm ||
          a.id.localeCompare(b.id),
      );
      nearest = nearest.slice(0, skip + take);
      if (rows.length < 250) break;
      cursor = rows[rows.length - 1].id;
    }
    return pageResult(
      nearest.slice(skip).map((row) => ({
        ...row,
        approximateDistanceKm: Number(row.approximateDistanceKm.toFixed(2)),
      })),
      query,
    );
  }
  async pending(query: PaginationQuery) {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'PENDING_APPROVAL', deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }
  async detail(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, ...this.publicWhere() },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return toPublicListing(listing);
  }
  async adminLookup(identifier: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { ...listingIdentifierWhere(identifier), deletedAt: null },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }
  async mine(authUser: AuthenticatedUser, query: PaginationQuery) {
    const owner = await this.users.findOrCreate(authUser);
    const listings = await this.prisma.listing.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    const cutoff = cutoffDate(
      new Date(),
      availabilityPolicy(this.config).staleDays,
    );
    // Lets owners see which approved homes are currently hidden from public browsing.
    const withVisibility = listings.map((listing) => ({
      ...listing,
      availabilityStale:
        listing.status === 'ACTIVE' && isStale(listing, cutoff),
    }));
    return pageResult(withVisibility, query);
  }
  async moderate(id: string, status: 'ACTIVE' | 'REJECTED') {
    const result = await this.prisma.listing.updateMany({
      where: { id, status: 'PENDING_APPROVAL', deletedAt: null },
      data: { status },
    });
    if (!result.count) {
      if (
        !(await this.prisma.listing.findFirst({
          where: { id, deletedAt: null },
        }))
      )
        throw new NotFoundException('Listing not found');
      throw new ConflictException(
        'Only pending listings can be approved or rejected',
      );
    }
    return this.prisma.listing.findUniqueOrThrow({ where: { id } });
  }
  async reconfirm(authUser: AuthenticatedUser, id: string) {
    const owner = await this.users.findOrCreate(authUser);
    const result = await this.prisma.listing.updateMany({
      where: { id, ownerId: owner.id, deletedAt: null },
      // A fresh confirmation also re-arms the next reminder.
      data: { lastAvailabilityConfirmedAt: new Date(), reminderSentAt: null },
    });
    if (!result.count) throw new NotFoundException('Listing not found');
    return this.prisma.listing.findUniqueOrThrow({ where: { id } });
  }
  async remove(id: string, actorId: string, admin = false, reason?: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing || listing.deletedAt)
      throw new NotFoundException('Listing not found');
    if (!admin && listing.ownerId !== actorId)
      throw new ForbiddenException('Not your listing');
    if (admin && !reason?.trim())
      throw new BadRequestException('A deletion reason is required');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.listing.update({
        where: { id },
        data: {
          deletedAt: now,
          deletedByAdminId: admin ? actorId : null,
          deletionReason: admin ? reason!.trim() : null,
        },
      }),
      this.prisma.match.updateMany({
        where: { listingId: id, invalidatedAt: null },
        data: { invalidatedAt: now, invalidationReason: 'Listing deleted' },
      }),
      ...(admin
        ? [
            this.prisma.notification.create({
              data: {
                userId: listing.ownerId,
                type: 'ADMIN_DELETION',
                title: 'Your property was removed',
                message: `${listing.reference ?? listing.areaText} was removed. Reason: ${reason!.trim()}`,
              },
            }),
          ]
        : []),
    ]);
    return { id, deletedAt: now };
  }
  async removeMine(authUser: AuthenticatedUser, id: string) {
    const owner = await this.users.findOrCreate(authUser);
    return this.remove(id, owner.id);
  }
  async removeAdmin(authUser: AuthenticatedUser, id: string, reason: string) {
    const admin = await this.users.findOrCreate(authUser);
    return this.remove(id, admin.id, true, reason);
  }
}
