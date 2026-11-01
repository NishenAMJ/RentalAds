import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Fields shared by every listing category: where it is, how to reach the owner, and its photos. */
export class ListingBaseDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { each: true },
  )
  photoUrls?: string[];
  @IsString() @IsNotEmpty() @MaxLength(300) areaText!: string;
  @IsOptional()
  @IsUrl({ protocols: ['https', 'http'], require_protocol: true })
  @MaxLength(2048)
  mapLink?: string;
  @ValidateIf(
    (value: ListingBaseDto) =>
      value.latitude !== undefined || value.longitude !== undefined,
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @ValidateIf(
    (value: ListingBaseDto) =>
      value.latitude !== undefined || value.longitude !== undefined,
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
  @IsString()
  @Matches(/^\+947[0-9]{8}$/, {
    message:
      'Contact phone number must be a Sri Lankan mobile number in +947XXXXXXXX format',
  })
  ownerContact!: string;
}
