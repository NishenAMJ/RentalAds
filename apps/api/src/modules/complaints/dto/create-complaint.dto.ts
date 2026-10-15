import { IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';
import { ComplaintTargetType } from '@prisma/client';

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
