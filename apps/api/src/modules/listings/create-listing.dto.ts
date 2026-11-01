import { FurnishingStatus, PropertySize, PropertyType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ListingBaseDto } from './listing-base.dto';

export class CreateListingDto extends ListingBaseDto {
  @IsEnum(PropertyType) propertyType!: PropertyType;
  @IsEnum(PropertySize) size!: PropertySize;
  @IsInt() @Min(0) @Max(100) bedrooms!: number;
  @IsInt() @Min(1) @Max(100) bathrooms!: number;
  @IsBoolean() parking!: boolean;
  @IsEnum(FurnishingStatus) furnishing!: FurnishingStatus;
  @IsInt() @Min(1) @Max(2147483647) monthlyRent!: number;
  @IsInt() @Min(1) @Max(1200) minDurationMonths!: number;
  @IsBoolean() keyMoney!: boolean;
  @ValidateIf(
    (value: CreateListingDto) => value.keyMoney || value.keyMoneyAmount != null,
  )
  @IsInt()
  @Min(1)
  @Max(2147483647)
  keyMoneyAmount?: number;
}
