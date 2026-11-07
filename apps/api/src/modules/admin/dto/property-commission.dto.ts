import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CommissionStatus, PropertyFeeType } from '@prisma/client';

import { PaginationQuery } from '../../../common/pagination';

export {
  CommissionStatus as CommissionStatusDto,
  PropertyFeeType as PropertyFeeTypeDto,
} from '@prisma/client';

export class CreatePropertyCommissionDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsEnum(PropertyFeeType)
  feeType?: PropertyFeeType;

  @IsOptional()
  @IsInt()
  @Min(1)
  agreedRent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  ratePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentReference?: string;
}

export class UpdatePropertyCommissionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  agreedRent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  ratePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class PropertyCommissionQueryDto extends PaginationQuery {
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsEnum(PropertyFeeType)
  feeType?: PropertyFeeType;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}
