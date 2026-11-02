import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateOwnerPayoutDto {
  @IsUUID() bookingId!: string;
  @IsInt() @Min(1) @Max(2147483647) amount!: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class RecordOwnerPayoutDto {
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, { message: 'Transfer reference is required' })
  transferReference!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
