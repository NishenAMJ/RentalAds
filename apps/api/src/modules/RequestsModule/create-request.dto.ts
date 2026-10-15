import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';
import { PropertyType, PropertySize, FurnishingStatus } from '@prisma/client';
import { SearchAreaDto } from '../../common/search-area.dto';

export class CreateRequestDto extends SearchAreaDto {
  @IsString()
  @Matches(/\S/, { message: 'Preferred areas cannot be blank' })
  areaText!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @IsInt()
  @Min(0)
  budgetMax!: number;

  @IsInt()
  @Min(1)
  durationMonths!: number;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;

  @IsOptional()
  @IsEnum(PropertySize)
  size?: PropertySize;

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsBoolean()
  parking?: boolean;

  @IsOptional()
  @IsEnum(FurnishingStatus)
  furnishing?: FurnishingStatus;

  @IsString()
  @Matches(/^\+947\d{8}$/, {
    message:
      'Contact number must be a Sri Lankan mobile number, for example +94712345678',
  })
  renterContact!: string;
}
