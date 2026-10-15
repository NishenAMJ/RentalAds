/// <reference types="jest" />
import {
  detectImageMime,
  matchesDeclaredImageType,
} from '../src/common/image-signature';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);

describe('detectImageMime', () => {
  it.each([
    ['image/jpeg', jpeg],
    ['image/png', png],
    ['image/webp', webp],
  ])('recognises %s from its leading bytes', (mime, buffer) => {
    expect(detectImageMime(buffer)).toBe(mime);
  });

  it('rejects scripts, HTML and truncated files', () => {
    expect(
      detectImageMime(Buffer.from('<script>alert(1)</script>')),
    ).toBeNull();
    expect(detectImageMime(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });

  it('does not treat a RIFF container that is not WebP as an image', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE'),
    ]);
    expect(detectImageMime(wav)).toBeNull();
  });
});

describe('matchesDeclaredImageType', () => {
  it('requires the content to agree with the declared type', () => {
    expect(matchesDeclaredImageType(png, 'image/png')).toBe(true);
    expect(matchesDeclaredImageType(png, 'image/jpeg')).toBe(false);
    expect(matchesDeclaredImageType(jpeg, 'text/html')).toBe(false);
  });
});
