/** Pure helpers for the typewriter effect. Kept free of React so they are easy to test. */

/**
 * Splits text into the characters a reader actually sees. Sinhala and Tamil letters are built from several
 * code points (a consonant plus vowel signs), so cutting by string index would flash broken glyphs mid-word.
 */
export function graphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment);
  return Array.from(text); // older browsers: whole code points, still never half an emoji or half a surrogate pair
}

export interface TypingProgress {
  /** How many characters of each line are visible. */
  counts: number[];
  done: boolean;
}

/** Ticks needed to type every line, including the pause between lines. */
export function totalTicks(lengths: number[], pause: number): number {
  return lengths.reduce((sum, length) => sum + length, 0) + pause * Math.max(0, lengths.length - 1);
}

/**
 * What is visible after `tick` steps. One tick types one character; after a line is finished the typist
 * waits `pause` ticks before starting the next. Lines are typed strictly in order.
 */
export function progressAt(lengths: number[], tick: number, pause = 6): TypingProgress {
  const counts: number[] = [];
  let remaining = Math.max(0, tick);
  for (let index = 0; index < lengths.length; index++) {
    const typed = Math.min(remaining, lengths[index]);
    counts.push(typed);
    remaining -= typed;
    const finishedLine = typed === lengths[index];
    const isLast = index === lengths.length - 1;
    if (!finishedLine || (!isLast && remaining < pause)) {
      while (counts.length < lengths.length) counts.push(0);
      return { counts, done: false };
    }
    if (!isLast) remaining -= pause;
  }
  return { counts, done: true };
}

/** The visible start of a line, given its characters and how many to show. */
export const visiblePart = (characters: string[], count: number): string => characters.slice(0, count).join("");
