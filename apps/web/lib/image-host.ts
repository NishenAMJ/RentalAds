/** Hosts configured in next.config.ts `images.remotePatterns`. Only these can use the Next.js image optimiser. */
export const OPTIMISED_IMAGE_HOSTS: readonly string[] = ["res.cloudinary.com"];

/**
 * True when a photo URL can go through the optimiser (resized, modern formats, lazy loaded).
 * Other HTTPS hosts are still shown, but as-is, because the optimiser refuses hosts that are not allow-listed.
 */
export function canOptimise(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && OPTIMISED_IMAGE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
