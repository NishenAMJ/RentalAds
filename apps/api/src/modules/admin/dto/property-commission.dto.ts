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
import { Type } from 'class-transformer';
import { PaginationQuery } from '../../../common/pagination';

export enum CommissionStatusDto {
  DUE = 'DUE',
  INVOICED = 'INVOICED',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
}

export enum PropertyFeeTypeDto {
  COMMISSION = 'COMMISSION',
  LISTING_FEE = 'LISTING_FEE',
}

export class CreatePropertyCommissionDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsEnum(PropertyFeeTypeDto)
  feeType?: PropertyFeeTypeDto;

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
  @IsEnum(CommissionStatusDto)
  status?: CommissionStatusDto;

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
  @IsEnum(CommissionStatusDto)
  status?: CommissionStatusDto;

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
  @IsEnum(CommissionStatusDto)
  status?: CommissionStatusDto;

  @IsOptional()
  @IsEnum(PropertyFeeTypeDto)
  feeType?: PropertyFeeTypeDto;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}

