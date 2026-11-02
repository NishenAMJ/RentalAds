import { AccountStatus, OwnerVerificationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../../common/pagination';

export class AdminUsersQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @IsOptional()
  @IsEnum(OwnerVerificationStatus)
  verificationStatus?: OwnerVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
