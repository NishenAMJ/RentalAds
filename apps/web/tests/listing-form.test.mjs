import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeContactPhone, validateListingForm } from '../lib/listing-form.ts';
import { initialRequest, requestPayload, validateRequestStep } from '../lib/rental-request-form.ts';

test('private request steps validate only the current fields and preserve optional preferences', () => {
  assert.ok(validateRequestStep(initialRequest, 0).areaText);
  const valid = { ...initialRequest, areaText: ' Colombo 5 ', budgetMax: '100000', bedrooms: '0', renterContact: '71 234 5678' };
  for (let step = 0; step < 4; step++) assert.deepEqual(validateRequestStep(valid, step), {});
  const payload = requestPayload(valid);
  assert.equal(payload.areaText, 'Colombo 5');
  assert.equal(payload.renterContact, '+94712345678');
  assert.equal(payload.bedrooms, 0);
  assert.equal(payload.budgetMax, 100000);
  assert.equal(payload.parking, undefined);
  assert.equal(payload.budgetMin, undefined);
  assert.equal(requestPayload({ ...valid, propertyType: 'HOUSE', size: 'STUDIO' }).size, undefined);
});

test('private request rejects invalid budgets, duration, room counts and phone numbers', () => {
  for (const budgetMax of ['', '0', '-1', '1.5', 'NaN', '2147483648']) {
    assert.ok(validateRequestStep({ ...initialRequest, budgetMax }, 1).budgetMax);
  }
  assert.ok(validateRequestStep({ ...initialRequest, budgetMin: '200', budgetMax: '100' }, 1).budgetMin);
  assert.ok(validateRequestStep({ ...initialRequest, durationMonths: '0' }, 1).durationMonths);
  assert.ok(validateRequestStep({ ...initialRequest, bedrooms: '-1' }, 2).bedrooms);
  assert.ok(validateRequestStep({ ...initialRequest, renterContact: '0712345678' }, 3).renterContact);
  assert.ok(validateRequestStep({ ...initialRequest, areaText: ' ' }, 0).areaText);
});

const ready = { urls: [], uploading: false, failed: false };
test('optional perimeter survives payload creation and clearing preserves text fallback', () => {
  const form = { ...initialRequest, areaText: 'Colombo 5', searchArea: { lat: 6.9271, lng: 79.8612, radiusKm: 3 } };
  assert.deepEqual(validateRequestStep(form, 0), {});
  assert.equal(requestPayload(form).searchRadiusKm, 3);
  assert.equal(requestPayload(form).searchLatitude, 6.9271);
  assert.equal(requestPayload({ ...form, searchArea: null }).searchLatitude, undefined);
  assert.equal(requestPayload({ ...form, searchArea: null }).areaText, 'Colombo 5');
  for (const radiusKm of [0, 11, NaN, Infinity]) assert.ok(validateRequestStep({ ...form, searchArea: { ...form.searchArea, radiusKm } }, 0).searchArea);
  assert.ok(validateRequestStep({ ...form, areaText: '' }, 0).areaText);
});
test('map selection accepts valid coordinates and rejects invalid positions', () => {
  for (const location of [null, { lat: 0, lng: 0 }, { lat: 6.9271, lng: 79.8612 }, { lat: -90, lng: 180 }]) {
    assert.deepEqual(validateListingForm(form(), ready, location), []);
  }
  for (const location of [{ lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: 0, lng: Infinity }]) {
    assert.ok(validateListingForm(form(), ready, location).some(issue => issue.field === 'location'));
  }
});
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ propertyType: 'HOUSE', bedrooms: '2', bathrooms: '1', monthlyRent: '85000', minDurationMonths: '12', areaText: 'Nugegoda', furnishing: 'UNFURNISHED', contactPhone: '71 234 5678', ...overrides })) data.set(key, value);
  return data;
}

test('normalizes mobile numbers into one canonical database format', () => {
  for (const value of ['712345678', '71 234 5678', '71-234-5678']) assert.equal(normalizeContactPhone(value), '+94712345678');
  for (const value of ['', '0712345678', '+94712345678', '112345678', '71234567', '7123456789', '71abc5678', 'owner@pilot.test']) assert.equal(normalizeContactPhone(value), null);
});
test('valid house and zero-bedroom studio pass validation', () => {
  assert.deepEqual(validateListingForm(form(), ready), []);
  assert.deepEqual(validateListingForm(form({ propertyType: 'APARTMENT', size: 'STUDIO', bedrooms: '0' }), ready), []);
});
test('collects every missing or invalid field for the summary', () => {
  const result = validateListingForm(form({ contactPhone: 'bad', areaText: ' ', monthlyRent: '-1', bathrooms: '0', bedrooms: '1.5', minDurationMonths: '' }), ready);
  assert.deepEqual(result.map(issue => issue.field).sort(), ['areaText', 'bathrooms', 'bedrooms', 'contactPhone', 'minDurationMonths', 'monthlyRent'].sort());
});
test('apartment size is required only for apartments', () => {
  for (const size of ['', 'N_A', 'invalid']) assert.ok(validateListingForm(form({ propertyType: 'APARTMENT', size }), ready).some(issue => issue.field === 'size'));
  for (const size of ['STUDIO', 'ONE_BR', 'TWO_BR', 'THREE_BR_PLUS']) assert.deepEqual(validateListingForm(form({ propertyType: 'APARTMENT', size }), ready), []);
});
test('key money amount is validated only when key money is checked', () => {
  assert.deepEqual(validateListingForm(form({ keyMoneyAmount: '' }), ready), []);
  for (const amount of ['', '0', '-1', '1.5']) assert.ok(validateListingForm(form({ keyMoney: 'on', keyMoneyAmount: amount }), ready).some(issue => issue.field === 'keyMoneyAmount'));
  assert.deepEqual(validateListingForm(form({ keyMoney: 'on', keyMoneyAmount: '150000' }), ready), []);
});
test('invalid numeric and URL values cannot bypass client validation', () => {
  for (const monthlyRent of ['0', '-10', 'NaN', '1e5', '150,000', '2147483648']) assert.ok(validateListingForm(form({ monthlyRent }), ready).some(issue => issue.field === 'monthlyRent'));
  assert.ok(validateListingForm(form({ mapLink: 'javascript:alert(1)' }), ready).some(issue => issue.field === 'mapLink'));
  assert.deepEqual(validateListingForm(form({ mapLink: 'https://maps.google.com/?q=Nugegoda' }), ready), []);
});
test('pending or failed uploads block submission; successful uploads do not', () => {
  assert.ok(validateListingForm(form(), { ...ready, uploading: true }).some(issue => issue.field === 'photos'));
  assert.ok(validateListingForm(form(), { ...ready, failed: true }).some(issue => issue.field === 'photos'));
  assert.deepEqual(validateListingForm(form(), { ...ready, urls: ['https://res.cloudinary.com/pilot/photo.jpg'] }), []);
});
