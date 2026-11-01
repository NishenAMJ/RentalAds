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
import type { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/auth.guard';
import { UsersService } from '../users/users.service';
import type { CreateListingDto } from './create-listing.dto';
import type { CreateItemListingDto } from './create-item-listing.dto';
import {
  CATEGORY_DEFINITIONS,
  isItemCategory,
  validateAttributes,
} from '../categories/category-registry';
import type { AdminListingsQuery } from './admin-listings.query';
import { toPublicListing } from './public-listing';
import { SearchListingsQuery } from '../../common/search-area.dto';
import { boundingBox, distanceKm } from '../../common/geography';
import { listingIdentifierWhere } from './listing-identifier';
import { NotifyService } from '../notifications/notify.service';
import type { CreateBlockDto, UpdateListingDto } from './update-listing.dto';
import {
  formatCalendarDate,
  parseCalendarDate,
  todayInSriLanka,
} from '../bookings/booking-rules';
import { holdingDates, overlapping } from '../bookings/booking-holds';
import { listingFilterWhere, listingOrderBy } from './listing-filters';
import {
  availabilityPolicy,
  cutoffDate,
  isStale,
  publicVisibility,
} from './availability';

/** Lets admins and renters open the exact spot on a map without publishing it as an address. */
function mapLinkFor(input: {
  latitude?: number;
  longitude?: number;
  mapLink?: string;
}) {
  return input.latitude != null && input.longitude != null
    ? `https://www.openstreetmap.org/?mlat=${input.latitude}&mlon=${input.longitude}#map=16/${input.latitude}/${input.longitude}`
    : input.mapLink;
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly notify: NotifyService,
  ) {}

  /** Public visibility: active, not deleted, and availability confirmed recently enough. */
  private publicWhere(now = new Date()) {
    return publicVisibility(this.config, now);
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
        mapLink: mapLinkFor(input),
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
  /** Offers an item (vehicle, equipment, event gear) for dated bookings. Pending until an admin approves it. */
  async createItem(authUser: AuthenticatedUser, input: CreateItemListingDto) {
    this.assertCategoryEnabled(input.category);
    if (
      !CATEGORY_DEFINITIONS[input.category].ratePeriods.includes(
        input.ratePeriod,
      )
    )
      throw new BadRequestException(
        `This category can be priced per ${CATEGORY_DEFINITIONS[input.category].ratePeriods.join(' or ').toLowerCase()}`,
      );
    const attributes = validateAttributes(input.category, input.attributes);
    const owner = await this.users.findOrCreate(authUser, 'OWNER');
    return this.prisma.listing.create({
      data: {
        category: input.category,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        attributes,
        areaText: input.areaText.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        mapLink: mapLinkFor(input),
        monthlyRent: input.rate,
        ratePeriod: input.ratePeriod,
        depositAmount: input.depositAmount ?? null,
        ownerContact: input.ownerContact.trim(),
        photoUrls: input.photoUrls ?? [],
        ownerId: owner.id,
        status: 'PENDING_APPROVAL',
      },
    });
  }
  private assertCategoryEnabled(category: string) {
    const enabled = this.config
      .get<string>('ENABLED_CATEGORIES')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (enabled?.length && !enabled.includes(category))
      throw new BadRequestException('This category is not open yet');
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
  /** Every non-deleted listing for admins, optionally narrowed to one status. */
  async adminList(query: AdminListingsQuery) {
    const rows = await this.prisma.listing.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }
  pending(query: PaginationQuery) {
    return this.adminList({ ...query, status: 'PENDING_APPROVAL' });
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
  /** Moves a listing between statuses, only from the status the admin acted on. */
  private async transition(
    id: string,
    from: ListingStatus,
    to: ListingStatus,
    conflictMessage: string,
  ) {
    const result = await this.prisma.listing.updateMany({
      where: { id, status: from, deletedAt: null },
      data: { status: to },
    });
    if (!result.count) {
      if (
        !(await this.prisma.listing.findFirst({
          where: { id, deletedAt: null },
        }))
      )
        throw new NotFoundException('Listing not found');
      throw new ConflictException(conflictMessage);
    }
    return this.prisma.listing.findUniqueOrThrow({ where: { id } });
  }
  /** One of the caller's own listings in any status, for the edit screen. */
  async ownListing(authUser: AuthenticatedUser, id: string) {
    const owner = await this.users.findOrCreate(authUser);
    const listing = await this.prisma.listing.findFirst({
      where: { id, ownerId: owner.id, deletedAt: null },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  /**
   * Owner edits. Price, deposit and contact apply at once. Anything renters read or see (title, description,
   * photos, area, details) sends a live or rejected listing back for review, so approval cannot be bypassed by
   * editing afterwards. Existing bookings keep the price they were made at.
   */
  async update(
    authUser: AuthenticatedUser,
    id: string,
    input: UpdateListingDto,
  ) {
    const listing = await this.ownListing(authUser, id);
    const item = isItemCategory(listing.category);
    const itemOnly = [
      'title',
      'description',
      'rate',
      'ratePeriod',
      'depositAmount',
      'attributes',
    ] as const;
    const homeOnly = [
      'monthlyRent',
      'minDurationMonths',
      'keyMoney',
      'keyMoneyAmount',
    ] as const;
    const given = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (!given.length) throw new BadRequestException('Nothing to change');
    const notAllowed = given.filter((key) =>
      (item
        ? (homeOnly as readonly string[])
        : (itemOnly as readonly string[])
      ).includes(key),
    );
    if (notAllowed.length)
      throw new BadRequestException(
        `${notAllowed.join(', ')} cannot be changed on this listing`,
      );

    const data: Prisma.ListingUpdateInput = {};
    let material = false;
    if (input.rate !== undefined) data.monthlyRent = input.rate;
    if (input.monthlyRent !== undefined) data.monthlyRent = input.monthlyRent;
    if (input.ratePeriod !== undefined) {
      if (
        !CATEGORY_DEFINITIONS[listing.category].ratePeriods.includes(
          input.ratePeriod,
        )
      )
        throw new BadRequestException(
          'This category cannot be priced per ' +
            input.ratePeriod.toLowerCase(),
        );
      data.ratePeriod = input.ratePeriod;
    }
    if (input.depositAmount !== undefined)
      data.depositAmount = input.depositAmount;
    if (input.minDurationMonths !== undefined)
      data.minDurationMonths = input.minDurationMonths;
    if (input.ownerContact !== undefined)
      data.ownerContact = input.ownerContact.trim();
    if (input.keyMoney !== undefined || input.keyMoneyAmount !== undefined) {
      const keyMoney = input.keyMoney ?? listing.keyMoney;
      const amount = input.keyMoneyAmount ?? listing.keyMoneyAmount;
      if (keyMoney && !amount)
        throw new BadRequestException('Key money requires an amount');
      if (!keyMoney && input.keyMoneyAmount !== undefined)
        throw new BadRequestException(
          'Key money amount requires key money to be enabled',
        );
      data.keyMoney = keyMoney;
      data.keyMoneyAmount = keyMoney ? amount : null;
    }
    if (input.title !== undefined) {
      data.title = input.title.trim();
      material = true;
    }
    if (input.description !== undefined) {
      data.description = input.description.trim() || null;
      material = true;
    }
    if (input.areaText !== undefined) {
      data.areaText = input.areaText.trim();
      material = true;
    }
    if (input.photoUrls !== undefined) {
      data.photoUrls = input.photoUrls;
      material = true;
    }
    if (input.attributes !== undefined) {
      data.attributes = validateAttributes(listing.category, input.attributes);
      material = true;
    }
    if (
      material &&
      (listing.status === 'ACTIVE' || listing.status === 'REJECTED')
    )
      data.status = 'PENDING_APPROVAL';
    // Editing shows the owner is looking after the listing, so it counts as a fresh availability confirmation.
    data.lastAvailabilityConfirmedAt = new Date();
    data.reminderSentAt = null;
    return this.prisma.listing.update({ where: { id }, data });
  }

  async listBlocks(authUser: AuthenticatedUser, listingId: string) {
    await this.ownListing(authUser, listingId);
    const rows = await this.prisma.listingBlock.findMany({
      where: { listingId, endDate: { gt: todayInSriLanka() } },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      startDate: formatCalendarDate(row.startDate),
      endDate: formatCalendarDate(row.endDate),
      note: row.note,
    }));
  }

  /** Takes dates off the calendar. Refused if a renter already holds any of them. */
  async addBlock(
    authUser: AuthenticatedUser,
    listingId: string,
    input: CreateBlockDto,
  ) {
    const listing = await this.ownListing(authUser, listingId);
    if (!isItemCategory(listing.category))
      throw new BadRequestException(
        'Only items booked by date have a calendar',
      );
    const start = parseCalendarDate(input.startDate);
    const end = parseCalendarDate(input.endDate);
    const days = (end.getTime() - start.getTime()) / 86_400_000;
    if (start < todayInSriLanka())
      throw new BadRequestException('The start date cannot be in the past');
    if (days < 1)
      throw new BadRequestException(
        'The end date must be after the start date',
      );
    if (days > 365)
      throw new BadRequestException('A block can be at most 365 days');
    const now = new Date();
    const block = await this.prisma.$transaction(async (tx) => {
      // The same lock bookings take, so a booking and a block cannot both claim the dates.
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${listingId} FOR UPDATE`;
      const clash = await tx.booking.findFirst({
        where: { listingId, ...overlapping(start, end), ...holdingDates(now) },
        select: { id: true },
      });
      if (clash)
        throw new ConflictException(
          'A renter has already booked some of those dates',
        );
      return tx.listingBlock.create({
        data: {
          listingId,
          startDate: start,
          endDate: end,
          note: input.note?.trim() || null,
        },
      });
    });
    return {
      id: block.id,
      startDate: input.startDate,
      endDate: input.endDate,
      note: block.note,
    };
  }

  async removeBlock(
    authUser: AuthenticatedUser,
    listingId: string,
    blockId: string,
  ) {
    await this.ownListing(authUser, listingId);
    const result = await this.prisma.listingBlock.deleteMany({
      where: { id: blockId, listingId },
    });
    if (!result.count) throw new NotFoundException('Block not found');
    return { id: blockId };
  }

  async moderate(id: string, status: 'ACTIVE' | 'REJECTED') {
    const listing = await this.transition(
      id,
      'PENDING_APPROVAL',
      status,
      'Only pending listings can be approved or rejected',
    );
    const name = listing.title ?? listing.reference ?? listing.areaText;
    await this.notify.send([
      status === 'ACTIVE'
        ? {
            userId: listing.ownerId,
            type: 'LISTING_APPROVED',
            title: 'Your listing is live',
            message: `${name} was approved and is now visible to renters.`,
            link: '/owner/listings',
          }
        : {
            userId: listing.ownerId,
            type: 'LISTING_REJECTED',
            title: 'Your listing was not approved',
            message: `${name} was not approved. You can edit it and submit it again.`,
            link: '/owner/listings',
          },
    ]);
    return listing;
  }
  /** Takes an approved listing off public browsing without deleting it. */
  deactivate(id: string) {
    return this.transition(
      id,
      'ACTIVE',
      'INACTIVE',
      'Only active listings can be deactivated',
    );
  }
  reactivate(id: string) {
    return this.transition(
      id,
      'INACTIVE',
      'ACTIVE',
      'Only inactive listings can be reactivated',
    );
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
