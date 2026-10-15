import assert from 'node:assert/strict';
import test from 'node:test';
import { canOptimise } from '../lib/image-host.ts';

test('only allow-listed HTTPS hosts use the image optimiser', () => {
  assert.equal(canOptimise('https://res.cloudinary.com/demo/image/upload/a.jpg'), true);
  assert.equal(canOptimise('http://res.cloudinary.com/demo/a.jpg'), false);
  assert.equal(canOptimise('https://images.example.org/a.jpg'), false);
  assert.equal(canOptimise('https://res.cloudinary.com.evil.test/a.jpg'), false);
  assert.equal(canOptimise('javascript:alert(1)'), false);
  assert.equal(canOptimise('not a url'), false);
});
