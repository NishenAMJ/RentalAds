import {
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ComplaintTargetType, DisputeType } from '@prisma/client';

export class CreateDisputeDto {
  @IsUUID() bookingId!: string;
  @IsEnum(DisputeType) issueType!: DisputeType;
  @IsString() @MinLength(20) @MaxLength(5000) @Matches(/\S/) reason!: string;
}

export class MyDisputeQuery {
  @IsUUID() bookingId!: string;
}

export class CreateComplaintDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  website?: string;
  @IsEnum(ComplaintTargetType)
  targetType!: ComplaintTargetType;

  @IsString()
  targetId!: string;

  @IsString()
  @MinLength(10)
  reason!: string;
}
