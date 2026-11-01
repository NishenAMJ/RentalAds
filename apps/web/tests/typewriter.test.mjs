import assert from 'node:assert/strict';
import test from 'node:test';
import { graphemes, progressAt, totalTicks, visiblePart } from '../lib/typewriter.ts';

test('English text splits into single characters', () => {
  assert.deepEqual(graphemes('A place'), ['A', ' ', 'p', 'l', 'a', 'c', 'e']);
  assert.deepEqual(graphemes(''), []);
});

test('Sinhala and Tamil letters are never cut in the middle', () => {
  const sinhalaText = 'ශ්‍රී ලංකාව';
  const sinhala = graphemes(sinhalaText);
  // Joining the pieces gives back the exact text, and combining signs stay attached to their letter.
  assert.equal(sinhala.join(''), sinhalaText);
  assert.ok(sinhala.length < Array.from(sinhalaText).length, 'fewer visible characters than code points');
  assert.ok(sinhala.every((piece) => !/^[්ා-ෟංඃ‍]/u.test(piece)), 'no piece starts with a combining sign');

  // Tamil: the dot-sign (pulli) belongs to its consonant, so "க்" is one unit, never "க" followed by a lone mark.
  const tamil = graphemes('க்ஷ');
  assert.deepEqual(tamil, ['க்', 'ஷ']);
  assert.ok(tamil.every((piece) => !/^[்ா-ௌ]/u.test(piece)), 'no piece starts with a vowel sign');
  assert.equal(visiblePart(sinhala, 2), sinhala.slice(0, 2).join(''));
});

test('lines type in order, with a pause between them', () => {
  const lengths = [3, 2, 4];
  assert.deepEqual(progressAt(lengths, 0, 2).counts, [0, 0, 0]);
  assert.deepEqual(progressAt(lengths, 2, 2).counts, [2, 0, 0]);
  assert.deepEqual(progressAt(lengths, 3, 2).counts, [3, 0, 0]);
  assert.deepEqual(progressAt(lengths, 4, 2).counts, [3, 0, 0], 'still pausing after the first line');
  assert.deepEqual(progressAt(lengths, 5, 2).counts, [3, 0, 0], 'the pause lasts exactly two ticks');
  assert.deepEqual(progressAt(lengths, 6, 2).counts, [3, 1, 0]);
  assert.deepEqual(progressAt(lengths, 7, 2).counts, [3, 2, 0]);
  assert.deepEqual(progressAt(lengths, 10, 2).counts, [3, 2, 1]);
});

test('typing is finished exactly at the total and stays finished', () => {
  const lengths = [3, 2, 4];
  const total = totalTicks(lengths, 2);
  assert.equal(total, 3 + 2 + 4 + 2 * 2);
  assert.equal(progressAt(lengths, total - 1, 2).done, false);
  assert.deepEqual(progressAt(lengths, total, 2), { counts: [3, 2, 4], done: true });
  assert.deepEqual(progressAt(lengths, total + 50, 2), { counts: [3, 2, 4], done: true });
});

test('progress never goes backwards as time passes', () => {
  const lengths = [5, 0, 7];
  let previous = [0, 0, 0];
  for (let tick = 0; tick <= totalTicks(lengths, 4) + 3; tick++) {
    const { counts } = progressAt(lengths, tick, 4);
    counts.forEach((value, index) => assert.ok(value >= previous[index], `line ${index} went backwards at tick ${tick}`));
    previous = counts;
  }
});

test('empty input and negative ticks are safe', () => {
  assert.deepEqual(progressAt([], 5), { counts: [], done: true });
  assert.deepEqual(progressAt([3], -4).counts, [0]);
  assert.equal(totalTicks([], 6), 0);
});
