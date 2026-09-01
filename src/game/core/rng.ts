/**
 * Deterministic, seedable RNG (mulberry32). Small, fast, good enough for a game.
 * Given the same seed it always produces the same stream, which is what makes
 * combat reproducible in tests.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** True with probability p (0..1). */
  chance(p: number): boolean;
  /** Random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/**
 * Combine a few integers into a single 32-bit seed. Used to derive a stable
 * per-battle seed from (saveSeed, stage, attempt).
 */
export function hashSeed(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const part of parts) {
    h ^= part >>> 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
