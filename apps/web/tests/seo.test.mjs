import assert from 'node:assert/strict';
import test from 'node:test';
import { listingDescription, listingJsonLd, listingTitle, serializeJsonLd, siteUrl } from '../lib/seo.ts';

const listing = {
  id: 'abc', reference: 'SL-000001', propertyType: 'APARTMENT', bedrooms: 2, bathrooms: 1,
  furnishing: 'SEMI_FURNISHED', areaText: 'Colombo 5', monthlyRent: 85000, photoUrls: ['https://img.example/a.jpg'],
};

test('titles and descriptions are readable and never include owner contact details', () => {
  assert.equal(listingTitle(listing), 'Apartment for rent in Colombo 5');
  const description = listingDescription(listing);
  assert.match(description, /2 bed, 1 bath, semi furnished apartment in Colombo 5/);
  assert.match(description, /85,000/);
  assert.doesNotMatch(JSON.stringify(listingJsonLd(listing, 'https://x.test')), /ownerContact|\+94/);
});

test('structured data describes the offer in LKR with an absolute URL', () => {
  const data = listingJsonLd(listing, 'https://rentalhub.test');
  assert.equal(data.url, 'https://rentalhub.test/property/abc');
  assert.equal(data.offers.priceCurrency, 'LKR');
  assert.equal(data.offers.price, 85000);
  assert.equal(data.image, 'https://img.example/a.jpg');
  assert.equal(listingJsonLd({ ...listing, photoUrls: [] }, 'https://x.test').image, undefined);
  assert.equal(listingJsonLd({ ...listing, propertyType: 'HOUSE' }, 'https://x.test').about['@type'], 'House');
});

test('JSON-LD cannot break out of its script tag', () => {
  const output = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
  assert.ok(!output.includes('</script>'));
  assert.equal(JSON.parse(output).name, '</script><script>alert(1)</script>');
});

test('siteUrl normalises the origin and falls back safely', () => {
  assert.equal(siteUrl('https://rentalhub.lk/some/path/'), 'https://rentalhub.lk');
  assert.equal(siteUrl('not a url'), 'http://localhost:3000');
  assert.equal(siteUrl(undefined), 'http://localhost:3000');
});
