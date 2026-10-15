import { FurnishingStatus, PropertySize, PropertyType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
  IsNumber,
} from 'class-validator';

export class CreateListingDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { each: true },
  )
  photoUrls?: string[];
  @IsEnum(PropertyType) propertyType!: PropertyType;
  @IsEnum(PropertySize) size!: PropertySize;
  @IsInt() @Min(0) @Max(100) bedrooms!: number;
  @IsInt() @Min(1) @Max(100) bathrooms!: number;
  @IsBoolean() parking!: boolean;
  @IsEnum(FurnishingStatus) furnishing!: FurnishingStatus;
  @IsString() @IsNotEmpty() @MaxLength(300) areaText!: string;
  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(2048)
  mapLink?: string;
  @ValidateIf(
    (value: CreateListingDto) =>
      value.latitude !== undefined || value.longitude !== undefined,
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @ValidateIf(
    (value: CreateListingDto) =>
      value.latitude !== undefined || value.longitude !== undefined,
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
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
  @IsString()
  @Matches(/^\+947[0-9]{8}$/, {
    message:
      'Contact phone number must be a Sri Lankan mobile number in +947XXXXXXXX format',
  })
  ownerContact!: string;
}
