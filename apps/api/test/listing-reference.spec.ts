import type { PropertyListing } from '../src/modules/matching/property-listing';
import { listingIdentifierWhere } from '../src/modules/listings/listing-identifier';
import { buildWhatsAppMessage } from '../src/modules/matching/message-generator';
import { toPublicListing } from '../src/modules/listings/public-listing';

describe('listing references and owner-contact privacy', () => {
  const listing = {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'SL-000123',
    propertyType: 'HOUSE',
    size: 'N_A',
    bedrooms: 2,
    bathrooms: 1,
    furnishing: 'UNFURNISHED',
    parking: true,
    areaText: 'Maharagama',
    monthlyRent: 30000,
    minDurationMonths: 6,
    ownerContact: '+94712345678',
    latitude: null,
    longitude: null,
    mapLink: 'https://maps.example/precise-home',
    photoUrls: [],
  } as unknown as PropertyListing;

  it('normalizes reference case and uses an indexed unique lookup', () => {
    expect(listingIdentifierWhere(' sl-000123 ')).toEqual({
      reference: 'SL-000123',
    });
    expect(listingIdentifierWhere(listing.id)).toEqual({ id: listing.id });
    expect(() => listingIdentifierWhere('SL-%')).toThrow('listing reference');
    expect(() => listingIdentifierWhere('invalid')).toThrow(
      'listing reference',
    );
  });

  it('includes the reference in renter messages without contact or precise links', () => {
    const message = buildWhatsAppMessage(
      listing,
      `https://example.test/property/${listing.id}`,
    );
    expect(message).toContain('Listing ID: SL-000123');
    expect(message).not.toContain(listing.ownerContact);
    expect(message).not.toContain('Owner contact');
    expect(message).not.toContain(listing.mapLink);
  });

  it('publishes the safe reference without owner contact or coordinates', () => {
    const result = toPublicListing(listing);
    expect(result.reference).toBe('SL-000123');
    expect(result).not.toHaveProperty('ownerContact');
    expect(result).not.toHaveProperty('latitude');
    expect(result).not.toHaveProperty('longitude');
  });
});
