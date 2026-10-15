import assert from 'node:assert/strict';
import test from 'node:test';
import { summariseCriteria } from '../lib/matching.ts';

const c = (status) => ({ key: status, label: status, status, detail: '' });

test('the summary counts each state and leaves out empty ones', () => {
  assert.equal(summariseCriteria([c('matched'), c('matched'), c('matched'), c('different')]), '3 matched · 1 different');
  assert.equal(summariseCriteria([c('matched'), c('unknown'), c('unspecified'), c('unspecified')]), '1 matched · 1 unverified · 2 not specified');
});

test('an empty list gives an empty summary rather than a misleading one', () => {
  assert.equal(summariseCriteria([]), '');
});

test('the order is stable so the same match always reads the same way', () => {
  assert.equal(summariseCriteria([c('unspecified'), c('different'), c('matched'), c('unknown')]), '1 matched · 1 different · 1 unverified · 1 not specified');
});
