export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

/**
 * Identifies an image by its leading bytes instead of trusting the
 * client-supplied MIME type or file name. Returns null for anything else.
 */
export function detectImageMime(buffer: Buffer): ImageMime | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png';
  // WebP: "RIFF" <size> "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'image/webp';
  return null;
}

/** True when the file's real content matches the MIME type it claims. */
export function matchesDeclaredImageType(
  buffer: Buffer,
  declared: string,
): boolean {
  return detectImageMime(buffer) === declared;
}
