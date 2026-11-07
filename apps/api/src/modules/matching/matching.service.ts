import { CommissionStatus, MatchStatus, PropertyFeeType } from '@prisma/client';
import type { RentalRequest } from '@prisma/client';
import { isPropertyListing, type PropertyListing } from './property-listing';
import {
  PaginationQuery,
  pageWindow,
  pageResult,
} from '../../common/pagination';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { passesHardFilters, locationFit } from './matching.logic';
import {
  assessMatch,
  comparePotentialMatches,
  type MatchAssessment,
} from './match-assessment';
import { listingIdentifierWhere } from '../listings/listing-identifier';
import { TopResults } from '../../common/top-results';
import { buildWhatsAppMessage } from './message-generator';

const PROPERTY_DETAIL_BASE_URL =
  process.env.PROPERTY_DETAIL_BASE_URL ?? 'http://localhost:3000/property';

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  private async *activeListingBatches() {
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.listing.findMany({
        where: { status: 'ACTIVE', category: 'PROPERTY', deletedAt: null },
        orderBy: { id: 'asc' },
        take: 250,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      yield batch.filter(
        (listing): listing is PropertyListing =>
          listing.status === 'ACTIVE' && isPropertyListing(listing),
      );
      if (batch.length < 250) break;
      cursor = batch[batch.length - 1].id;
    }
  }

  async dashboardMatches(query: PaginationQuery) {
    const { skip, take } = pageWindow(query);
    type Ranked = {
      id: string;
      requestId: string;
      requestArea: string;
      listing: PropertyListing;
      assessment: MatchAssessment;
    };
    const best = new TopResults<Ranked>(skip + take, comparePotentialMatches);
    let cursor: string | undefined;
    for (;;) {
      const requests: RentalRequest[] =
        await this.prisma.rentalRequest.findMany({
          where: { status: { not: 'CLOSED' }, deletedAt: null },
          orderBy: { id: 'asc' },
          take: 50,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
      // Reuse each listing batch for the entire request batch: no per-request SQL loop.
      if (requests.length)
        for await (const listings of this.activeListingBatches()) {
          for (const request of requests) {
            if (request.status === 'CLOSED') continue;
            for (const listing of listings)
              best.add({
                id: `${request.id}:${listing.id}`,
                requestId: request.id,
                requestArea: request.areaText,
                listing,
                assessment: assessMatch(listing, request),
              });
          }
        }
      if (requests.length < 50) break;
      cursor = requests[requests.length - 1].id;
    }
    const rows = best
      .sorted()
      .slice(skip)
      .map(({ listing, assessment, ...row }) => ({
        ...row,
        listingId: listing.id,
        reference: listing.reference,
        ownerContact: listing.ownerContact,
        areaText: listing.areaText,
        monthlyRent: listing.monthlyRent,
        ...assessment,
      }));
    return pageResult(rows, query);
  }

  async findSuggestionsForRequest(requestId: string, query: PaginationQuery) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    if (request.status === 'CLOSED')
      throw new BadRequestException('This request is closed');
    const { skip, take } = pageWindow(query);
    const best = new TopResults<{
      id: string;
      listing: PropertyListing;
      assessment: MatchAssessment;
    }>(skip + take, comparePotentialMatches);
    for await (const batch of this.activeListingBatches())
      for (const listing of batch) {
        best.add({
          id: listing.id,
          listing,
          assessment: assessMatch(listing, request),
        });
      }
    const result = pageResult(best.sorted().slice(skip), query);
    const saved = result.data.length
      ? await this.prisma.match.findMany({
          where: {
            requestId,
            invalidatedAt: null,
            listingId: { in: result.data.map((item) => item.listing.id) },
          },
          take: result.data.length,
        })
      : [];
    const savedByListing = new Map(
      saved.map((match) => [match.listingId, match]),
    );
    return {
      ...result,
      data: result.data.map(({ listing, assessment }) => {
        const match = savedByListing.get(listing.id);
        return {
          listingId: listing.id,
          reference: listing.reference,
          ownerContact: listing.ownerContact,
          areaText: listing.areaText,
          monthlyRent: listing.monthlyRent,
          latitude: listing.latitude == null ? null : Number(listing.latitude),
          longitude:
            listing.longitude == null ? null : Number(listing.longitude),
          ...assessment,
          matchId: match?.id ?? null,
          status: match?.status ?? null,
          locationOverrideReason: match?.locationOverrideReason ?? null,
          locationOverrideAdminId: match?.locationOverrideAdminId ?? null,
          locationOverrideAt: match?.locationOverrideAt ?? null,
          recommendationReason: match?.recommendationReason ?? null,
          recommendedByAdminId: match?.recommendedByAdminId ?? null,
          recommendationReviewedAt: match?.recommendationReviewedAt ?? null,
          whatsappMessage: buildWhatsAppMessage(
            listing,
            `${PROPERTY_DETAIL_BASE_URL}/${listing.id}`,
          ),
        };
      }),
    };
  }
  async lookupCandidate(requestId: string, listingId: string) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    if (request.status === 'CLOSED')
      throw new BadRequestException('This request is closed');
    const listing = await this.prisma.listing.findUnique({
      where: listingIdentifierWhere(listingId),
    });
    if (
      !listing ||
      listing.status !== 'ACTIVE' ||
      listing.deletedAt ||
      !isPropertyListing(listing)
    )
      throw new NotFoundException('Active listing not found');
    const fit = locationFit(listing, request);
    return {
      listing,
      ...fit,
      ...assessMatch(listing, request),
      meetsNonLocationRequirements: passesHardFilters(listing, request),
      locationWarning: fit.withinArea
        ? null
        : fit.distanceKm == null
          ? 'This property has no map pin. Its location cannot be verified.'
          : 'This property is outside the selected search perimeter.',
    };
  }
  async savedMatches(requestId: string, query: PaginationQuery) {
    const rows = await this.prisma.match.findMany({
      where: { requestId, invalidatedAt: null },
      include: { listing: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageWindow(query),
    });
    return pageResult(rows, query);
  }
  async saveSuggestion(
    requestId: string,
    listingId: string,
    locationOverrideReason?: string,
    authUserId?: string,
    recommendationReason?: string,
  ) {
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    if (request.status === 'CLOSED')
      throw new BadRequestException('This request is closed');
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt)
      throw new NotFoundException('Listing not found');
    if (listing.status !== 'ACTIVE')
      throw new BadRequestException('Only active listings can be recommended');
    if (!isPropertyListing(listing))
      throw new BadRequestException(
        'Only property listings can be matched to rental requests',
      );
    const assessment = assessMatch(listing, request);
    const fit = locationFit(listing, request);
    const reason =
      recommendationReason?.trim() || locationOverrideReason?.trim();
    if (recommendationReason !== undefined && !recommendationReason?.trim())
      throw new BadRequestException('A recommendation reason cannot be blank');
    if (locationOverrideReason !== undefined && fit.withinArea)
      throw new BadRequestException(
        'Location overrides apply only to outside-radius or missing-pin properties',
      );
    if (assessment.requiresReview && !reason)
      throw new BadRequestException(
        'A reason is required to recommend a property with different or unverified preferences',
      );
    // A legacy location-only reason must not silently approve unrelated differences.
    if (
      assessment.criteria.some(
        (c) => c.key !== 'area' && c.status === 'different',
      ) &&
      !recommendationReason?.trim()
    )
      throw new BadRequestException(
        'A recommendation reason is required for preference differences',
      );
    let audit = {};
    if (reason) {
      const actor = authUserId
        ? await this.prisma.user.findUnique({
            where: { authUserId },
            include: { adminPermission: true },
          })
        : null;
      if (!actor?.adminPermission?.canApproveListings)
        throw new BadRequestException(
          'An authorized administrator is required',
        );
      const now = new Date();
      audit = {
        recommendationReason: reason,
        recommendedByAdminId: actor.id,
        recommendationReviewedAt: now,
        ...(!fit.withinArea
          ? {
              locationOverrideReason: reason,
              locationOverrideAdminId: actor.id,
              locationOverrideAt: now,
            }
          : {}),
      };
    }
    const score = assessment.score;
    return this.prisma.match.upsert({
      where: { listingId_requestId: { listingId, requestId } },
      create: { listingId, requestId, score, ...audit },
      update: { score, ...audit },
    });
  }
  async updateStatus(
    id: string,
    status: MatchStatus,
    agreedRent?: number,
    commissionRatePercent?: number,
    authUserId?: string,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        listing: { select: { id: true, ownerId: true, monthlyRent: true } },
        commission: { select: { id: true } },
      },
    });
    if (!match || match.invalidatedAt)
      throw new NotFoundException('Match not found');
    const request = await this.prisma.rentalRequest.findUnique({
      where: { id: match.requestId },
    });
    if (!request || request.deletedAt)
      throw new NotFoundException('Request not found');
    if (request.status === 'CLOSED')
      throw new BadRequestException('This request is closed');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.match.update({
        where: { id },
        data: { status },
      });

      if (status === MatchStatus.RENTED && !match.commission) {
        const admin = authUserId
          ? await tx.user.findUnique({
              where: { authUserId },
              select: { id: true },
            })
          : null;
        const rent = agreedRent ?? match.listing.monthlyRent;
        const rate = commissionRatePercent ?? 30;
        const amount = Math.round((rent * rate) / 100);
        await tx.propertyCommission.create({
          data: {
            matchId: match.id,
            listingId: match.listing.id,
            ownerId: match.listing.ownerId,
            feeType: PropertyFeeType.COMMISSION,
            agreedRent: rent,
            ratePercent: rate,
            amount,
            status: CommissionStatus.DUE,
            createdById: admin?.id ?? null,
          },
        });
      }

      return updated;
    });
  }
}
