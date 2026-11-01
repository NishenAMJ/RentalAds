import { ListingStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class AdminListingsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
