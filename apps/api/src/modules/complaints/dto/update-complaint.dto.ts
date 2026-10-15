import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ComplaintStatus } from '@prisma/client';
export class UpdateComplaintDto {
  @IsEnum(ComplaintStatus)
  status!: ComplaintStatus;
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNotes?: string;
}
