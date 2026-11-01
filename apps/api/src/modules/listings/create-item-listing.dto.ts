import { ListingCategory, RatePeriod } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ITEM_CATEGORIES } from '../categories/category-registry';
import { ListingBaseDto } from './listing-base.dto';

/** A vehicle, piece of equipment or event gear offered for dated bookings. */
export class CreateItemListingDto extends ListingBaseDto {
  @IsIn(ITEM_CATEGORIES) category!: ListingCategory;
  @IsString() @MinLength(3) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  /** Price per `ratePeriod`, in whole LKR. */
  @IsInt() @Min(1) @Max(2147483647) rate!: number;
  @IsEnum(RatePeriod) ratePeriod!: RatePeriod;
  /** Refundable deposit paid with the booking. */
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) depositAmount?: number;
  /** Category-specific fields, validated against the category registry. */
  @IsObject() attributes!: Record<string, unknown>;
}
