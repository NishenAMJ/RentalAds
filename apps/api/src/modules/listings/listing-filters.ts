import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CATEGORY_DEFINITIONS } from '../categories/category-registry';
import type {
  ListingFilterQuery,
  ListingSort,
} from '../../common/listing-filters.dto';

type FilterInput = Pick<
  ListingFilterQuery,
  | 'area'
  | 'category'
  | 'subtype'
  | 'q'
  | 'propertyType'
  | 'furnishing'
  | 'minRent'
  | 'maxRent'
  | 'minBedrooms'
  | 'parking'
>;

/** Translates validated public filters into a Prisma `where` fragment. */
export function listingFilterWhere(
  filters: FilterInput,
): Prisma.ListingWhereInput {
  const { area, propertyType, furnishing, minRent, maxRent, minBedrooms } =
    filters;
  if (minRent !== undefined && maxRent !== undefined && minRent > maxRent)
    throw new BadRequestException(
      'Minimum rent cannot be higher than maximum rent',
    );
  const category = filters.category ?? 'PROPERTY';
  const typeField = CATEGORY_DEFINITIONS[category].typeField;
  if (filters.subtype && !typeField)
    throw new BadRequestException('This category has no types to filter by');
  const rent: Prisma.IntFilter | undefined =
    minRent !== undefined || maxRent !== undefined
      ? {
          ...(minRent !== undefined ? { gte: minRent } : {}),
          ...(maxRent !== undefined ? { lte: maxRent } : {}),
        }
      : undefined;
  return {
    category,
    ...(filters.subtype && typeField
      ? { attributes: { path: [typeField], equals: filters.subtype } }
      : {}),
    ...(filters.q
      ? { title: { contains: filters.q, mode: 'insensitive' } }
      : {}),
    ...(area ? { areaText: { contains: area, mode: 'insensitive' } } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(furnishing ? { furnishing } : {}),
    ...(rent ? { monthlyRent: rent } : {}),
    ...(minBedrooms !== undefined ? { bedrooms: { gte: minBedrooms } } : {}),
    // "Parking" is a requirement when set; leaving it out means no preference.
    ...(filters.parking ? { parking: true } : {}),
  };
}

/** Stable ordering for each sort option; the id breaks ties so pages never overlap. */
export function listingOrderBy(
  sort: ListingSort = 'newest',
): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ monthlyRent: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'price_desc':
      return [{ monthlyRent: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}
