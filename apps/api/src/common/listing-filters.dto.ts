import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListingCategory } from '@prisma/client';
import { PaginationQuery } from './pagination';

export const LISTING_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

const MAX_INT = 2147483647;
const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const booleanFlag = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Optional public search filters for the listings browse endpoint. */
export class ListingFilterQuery extends PaginationQuery {
  /** Which kind of listing to browse. Homes when omitted, so the existing property pages are unchanged. */
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  /** The category's type, for example CAR for vehicles. Needs `category`. */
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  subtype?: string;

  /** Words in an item listing's title. */
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Case-insensitive match on the area text, for example "Nugegoda". */
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsIn(['APARTMENT', 'HOUSE'])
  propertyType?: 'APARTMENT' | 'HOUSE';

  @IsOptional()
  @IsIn(['FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'])
  furnishing?: 'FURNISHED' | 'SEMI_FURNISHED' | 'UNFURNISHED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  minRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  maxRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minBedrooms?: number;

  /** When true, only homes with parking. Omit for no preference. */
  @IsOptional()
  @Transform(booleanFlag)
  @IsBoolean()
  parking?: boolean;

  @IsOptional()
  @IsIn(LISTING_SORTS)
  sort?: ListingSort;
}
