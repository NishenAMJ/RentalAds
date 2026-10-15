import { Transform } from 'class-transformer';
import { IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { ListingFilterQuery } from './listing-filters.dto';

export const searchKeys = [
  'searchLatitude',
  'searchLongitude',
  'searchRadiusKm',
] as const;
const hasArea = (value: object) =>
  searchKeys.some(
    (key) =>
      Object.prototype.hasOwnProperty.call(value, key) &&
      value[key] !== undefined,
  );
const numeric = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
export function SearchAreaFields<T extends new (...args: any[]) => object>(
  Base: T,
) {
  class Fields extends Base {
    @ValidateIf(hasArea)
    @Transform(numeric)
    @IsNumber()
    @Min(-90)
    @Max(90)
    searchLatitude?: number;
    @ValidateIf(hasArea)
    @Transform(numeric)
    @IsNumber()
    @Min(-180)
    @Max(180)
    searchLongitude?: number;
    @ValidateIf(hasArea)
    @Transform(numeric)
    @IsNumber()
    @Min(1)
    @Max(10)
    searchRadiusKm?: number;
  }
  return Fields;
}
export class SearchListingsQuery extends SearchAreaFields(ListingFilterQuery) {}
export class SearchAreaDto extends SearchAreaFields(class {}) {}
