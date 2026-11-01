import { RatePeriod } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAX_INT = 2147483647;

/**
 * Changes an owner may make to their own listing. Every field is optional; the service rejects the ones
 * that do not apply to the listing's category (for example `bedrooms` on a vehicle, or `rate` on a home).
 */
export class UpdateListingDto {
  // --- items
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_INT) rate?: number;
  @IsOptional() @IsEnum(RatePeriod) ratePeriod?: RatePeriod;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_INT) depositAmount?: number;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;

  // --- homes
  @IsOptional() @IsInt() @Min(1) @Max(MAX_INT) monthlyRent?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1200) minDurationMonths?: number;
  @IsOptional() @IsBoolean() keyMoney?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_INT) keyMoneyAmount?: number;

  // --- every category
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) areaText?: string;
  @IsOptional()
  @IsString()
  @Matches(/^\+947[0-9]{8}$/, {
    message:
      'Contact phone number must be a Sri Lankan mobile number in +947XXXXXXXX format',
  })
  ownerContact?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { each: true },
  )
  photoUrls?: string[];
}

export class CreateBlockDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate!: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
