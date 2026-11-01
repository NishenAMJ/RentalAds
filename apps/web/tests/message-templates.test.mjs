import assert from 'node:assert/strict';
import test from 'node:test';
import { MESSAGE_TEMPLATES, renderTemplate } from '../lib/message-templates.ts';

test('every template mentions the area and the team, and has a unique id', () => {
  assert.equal(new Set(MESSAGE_TEMPLATES.map((template) => template.id)).size, MESSAGE_TEMPLATES.length);
  for (const template of MESSAGE_TEMPLATES) {
    const text = template.render({ area: 'Colombo 5' });
    assert.match(text, /Colombo 5/);
    assert.match(text, /RentalHub Sri Lanka team/);
  }
});

test('templates never promise a match, a guarantee or a response time', () => {
  for (const template of MESSAGE_TEMPLATES) {
    assert.doesNotMatch(template.render({ area: 'Colombo 5' }), /guarantee|within \d|hours|escrow|verified|definitely/i);
  }
});

test('a blank area falls back to wording that still reads naturally', () => {
  assert.match(renderTemplate('first-contact', { area: '   ' }), /your preferred area/);
});

test('an unknown template is an error rather than an empty message', () => {
  assert.throws(() => renderTemplate('nope', { area: 'x' }), /Unknown message template/);
});
