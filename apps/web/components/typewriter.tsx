"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { graphemes, progressAt, totalTicks, visiblePart } from "@/lib/typewriter";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const CHARACTER_MS = 20; // about 4 seconds for the headline and the intro together
const PAUSE_TICKS = 8; // a short breath between lines

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Lives only as long as the page does: a refresh or a fresh visit types again, while moving around inside the app
// and coming back to Home does not make people sit through it twice.
let introPlayed = false;

/** Show everything at once for people who prefer reduced motion, and when the intro already played on this page load. */
function shouldSkip(): boolean {
  return introPlayed || window.matchMedia(REDUCED_MOTION).matches;
}

export interface Typewriter {
  /** The visible part of each input line right now. */
  lines: string[];
  /** True once every line is fully shown (or the animation was skipped). */
  done: boolean;
  /** Which line the cursor belongs to while typing, or null when finished. */
  cursorLine: number | null;
}

/**
 * Types the given lines one after another. The first render is always empty so server and browser markup agree;
 * the animation then starts, unless the visitor prefers reduced motion or it already played since this page loaded.
 * Once finished, later text changes (for example switching language) appear instantly instead of typing again.
 */
export function useTypewriter(texts: string[]): Typewriter {
  const skip = useSyncExternalStore(subscribe, shouldSkip, () => false);
  const characters = texts.map(graphemes);
  const lengths = characters.map((line) => line.length);
  const total = totalTicks(lengths, PAUSE_TICKS);

  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState(false);
  const totalRef = useRef(total);
  useEffect(() => { totalRef.current = total; }, [total]);

  useEffect(() => {
    if (skip || settled) return;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setTick(ticks);
      if (ticks >= totalRef.current) {
        window.clearInterval(timer);
        introPlayed = true;
        setSettled(true);
      }
    }, CHARACTER_MS);
    return () => window.clearInterval(timer);
  }, [skip, settled]);

  const progress = skip || settled ? { counts: lengths, done: true } : progressAt(lengths, tick, PAUSE_TICKS);
  // The cursor sits at the end of the last line that has started, which also keeps it in place during the pause between lines.
  const lastStarted = progress.counts.reduce((last, count, index) => (count > 0 ? index : last), 0);
  return {
    lines: characters.map((line, index) => visiblePart(line, progress.counts[index])),
    done: progress.done,
    cursorLine: progress.done ? null : lastStarted,
  };
}

/** The blinking bar after the character being typed. Purely decorative. */
export function Cursor() {
  return <span className="tw-cursor" aria-hidden="true" />;
}
