import { AccountStatus } from '@prisma/client';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;

  @IsString()
  @MaxLength(1000)
  @Matches(/\S/)
  reason!: string;
}
