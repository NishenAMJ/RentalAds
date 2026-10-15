import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export function pageWindow(query: PaginationQuery) {
  return { skip: (query.page - 1) * query.limit, take: query.limit + 1 };
}

export function pageResult<T>(rows: T[], query: PaginationQuery) {
  return {
    data: rows.slice(0, query.limit),
    page: query.page,
    limit: query.limit,
    hasNextPage: rows.length > query.limit,
  };
}
