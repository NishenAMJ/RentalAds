import { BookingStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The listing and dates, shared by price quotes and bookings. */
export class BookingWindowDto {
  @IsUUID() listingId!: string;
  @Matches(DATE, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;
  @Matches(DATE, { message: 'endDate must be YYYY-MM-DD' }) endDate!: string;
}

export class CreateBookingDto extends BookingWindowDto {
  @IsString()
  @Matches(/^\+947[0-9]{8}$/, {
    message:
      'Contact phone number must be a Sri Lankan mobile number in +947XXXXXXXX format',
  })
  renterContact!: string;
}

export class CreateBookingReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
}

export class AdminBookingsQuery extends PaginationQuery {
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  /** `DUE` lists only the bookings whose refund has not been sent yet. */
  @IsOptional() @IsIn(['DUE']) refund?: 'DUE';
}

export class RefundDoneDto {
  /** The PayHere refund reference, for the team's records. */
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
}

export class CancelBookingDto {
  @IsString() @MaxLength(1000) @Matches(/\S/) reason!: string;
}
