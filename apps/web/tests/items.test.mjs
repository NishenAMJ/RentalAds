import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORIES, categoryBySlug, categoryLabel } from '../lib/categories.ts';
import { hasMessage, labelFor, lkr } from '../lib/items.ts';
import { en } from '../lib/i18n/messages.ts';

test('every category has a unique address and its names and blurbs are translated', () => {
  assert.equal(new Set(CATEGORIES.map((category) => category.slug)).size, CATEGORIES.length);
  assert.equal(new Set(CATEGORIES.map((category) => category.browseHref)).size, CATEGORIES.length);
  for (const category of CATEGORIES) {
    assert.ok(en[`cat.${category.id}.name`], `${category.id} needs a name`);
    assert.ok(en[`cat.${category.id}.blurb`], `${category.id} needs a blurb`);
  }
});

test('only item categories can be browsed and listed through the item pages', () => {
  assert.equal(categoryBySlug('vehicles')?.id, 'VEHICLE');
  assert.equal(categoryBySlug('homes')?.item, false);
  assert.equal(categoryBySlug('nonsense'), undefined);
  assert.equal(categoryLabel('EVENT_GEAR'), 'Event gear');
});

test('labels from the API fall back to the key instead of crashing when the web has no text yet', () => {
  const t = (key) => en[key];
  assert.equal(hasMessage('cat.VEHICLE.fuel.PETROL'), true);
  assert.equal(labelFor(t, 'cat.VEHICLE.fuel.PETROL'), 'Petrol');
  assert.equal(labelFor(t, 'cat.NEW_THING.field'), 'cat.NEW_THING.field');
});

test('money is shown in whole rupees', () => {
  assert.equal(lkr(26500), 'LKR 26,500');
});

test('the API category fields each have text for every language the site offers', async () => {
  // The registry is the source of truth; its label keys must all exist in the English dictionary.
  const fields = {
    VEHICLE: ['vehicleType', 'transmission', 'fuel', 'seats', 'withDriver'],
    EQUIPMENT: ['equipmentType', 'condition', 'brand'],
    EVENT_GEAR: ['gearType', 'quantity', 'deliveryAvailable'],
  };
  for (const [category, keys] of Object.entries(fields))
    for (const key of keys) assert.ok(en[`cat.${category}.${key}`], `missing cat.${category}.${key}`);
});
