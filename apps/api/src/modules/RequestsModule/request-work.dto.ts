import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

/** Admin updates to a request's internal work state. Every field is optional. */
export class UpdateRequestWorkDto {
  /** Take the request. Mutually exclusive with `unassign`. */
  @IsOptional()
  @IsBoolean()
  assignToMe?: boolean;

  @IsOptional()
  @IsBoolean()
  unassign?: boolean;

  /** Private notes. An empty string clears them. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;

  /** Date to follow up on; null clears it. */
  @ValidateIf((_object, value) => value !== null)
  @IsOptional()
  @IsDateString()
  followUpAt?: string | null;
}

/** Filters for the admin request queue. */
export class AdminRequestQuery extends PaginationQuery {
  /** `me` shows the caller's requests; `unassigned` shows ones nobody has taken. */
  @IsOptional()
  @IsIn(['me', 'unassigned'])
  assigned?: 'me' | 'unassigned';

  @IsOptional()
  @IsIn(['OPEN', 'MATCHED', 'CLOSED'])
  status?: 'OPEN' | 'MATCHED' | 'CLOSED';
}
