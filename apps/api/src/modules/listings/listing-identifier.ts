import { BadRequestException } from '@nestjs/common';

export function listingIdentifierWhere(
  identifier: string,
): { id: string } | { reference: string } {
  const value = identifier.trim();
  if (/^SL-\d{6,20}$/i.test(value)) return { reference: value.toUpperCase() };
  if (/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value))
    return { id: value.toLowerCase() };
  throw new BadRequestException(
    'Enter a listing reference such as SL-000001 or a valid listing ID',
  );
}
