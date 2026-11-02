import { OwnerVerificationStatus } from '@prisma/client';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateOwnerVerificationDto {
  @IsEnum(OwnerVerificationStatus)
  status!: OwnerVerificationStatus;

  @IsString()
  @MaxLength(1000)
  @Matches(/\S/)
  note!: string;
}
