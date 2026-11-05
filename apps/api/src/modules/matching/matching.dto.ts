import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { MatchStatus } from '@prisma/client';
export class SaveSuggestionDto {
  @IsUUID()
  listingId!: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/, { message: 'An override reason cannot be blank' })
  locationOverrideReason?: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/, { message: 'A recommendation reason cannot be blank' })
  recommendationReason?: string;
}
export class UpdateMatchStatusDto {
  @IsEnum(MatchStatus)
  status!: MatchStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  agreedRent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;
}
