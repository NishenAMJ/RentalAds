import assert from 'node:assert/strict';
import test from 'node:test';
import { en, si, ta, LOCALES } from '../lib/i18n/messages.ts';
import { isLocale, translate } from '../lib/i18n/translate.ts';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

for (const [name, dictionary] of [['Sinhala', si], ['Tamil', ta]]) {
  test(`${name} only defines keys that exist in English`, () => {
    const unknown = Object.keys(dictionary).filter((key) => !(key in en));
    assert.deepEqual(unknown, []);
  });

  test(`${name} translates every key used by the translated screens`, () => {
    const missing = Object.keys(en).filter((key) => !dictionary[key]?.trim());
    assert.deepEqual(missing, []);
  });

  test(`${name} keeps the same {placeholders} as English`, () => {
    for (const [key, text] of Object.entries(dictionary)) {
      assert.deepEqual(placeholders(text), placeholders(en[key]), `placeholders differ for ${key}`);
    }
  });

  test(`${name} contains its own script, not copied English`, () => {
    const copied = Object.entries(dictionary).filter(([key, text]) => text === en[key] && /[A-Za-z]{4,}/.test(text));
    assert.deepEqual(copied.map(([key]) => key), []);
  });
}

test('translate returns the chosen language and falls back to English for missing keys', () => {
  assert.equal(translate('en', 'nav.signIn'), 'Sign in');
  assert.equal(translate('si', 'nav.signIn'), si['nav.signIn']);
  const original = ta['nav.signIn'];
  delete ta['nav.signIn'];
  try { assert.equal(translate('ta', 'nav.signIn'), 'Sign in'); } finally { ta['nav.signIn'] = original; }
});

test('translate fills placeholders and leaves unknown ones visible', () => {
  assert.equal(translate('en', 'listings.showing', { count: 6 }), 'Showing 6 on this page');
  assert.match(translate('si', 'listings.showing', { count: 6 }), /6/);
  assert.equal(translate('en', 'listings.showing', {}), 'Showing {count} on this page');
});

test('locale guard accepts only supported codes', () => {
  for (const { code } of LOCALES) assert.equal(isLocale(code), true);
  for (const bad of ['fr', '', null, undefined, 'EN']) assert.equal(isLocale(bad), false);
});
