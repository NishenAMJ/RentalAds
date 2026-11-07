import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ComplaintStatus } from '@prisma/client';
export class UpdateComplaintDto {
  @IsEnum(ComplaintStatus)
  status!: ComplaintStatus;
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNotes?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  resolution?: string;
}
