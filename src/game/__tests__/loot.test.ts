import { describe, it, expect } from 'vitest';
import { rollDrop } from '../systems/loot';
import { itemValue } from '../core/items';
import { mulberry32 } from '../core/rng';
import { RARITY_CONFIG } from '../content/affixes';

describe('rollDrop', () => {
  it('always drops on a boss stage', () => {
    for (let i = 0; i < 20; i++) {
      const drop = rollDrop({ stage: 10, rng: mulberry32(i), idSeed: i });
      expect(drop).not.toBeNull();
    }
  });

  it('affix count matches the rolled rarity', () => {
    for (let i = 0; i < 200; i++) {
      const drop = rollDrop({ stage: 12, rng: mulberry32(i * 7 + 1), idSeed: i });
      if (!drop) continue;
      expect(drop.affixes.length).toBe(RARITY_CONFIG[drop.rarity].affixCount);
    }
  });

  it('is deterministic for the same rng seed', () => {
    const a = rollDrop({ stage: 7, rng: mulberry32(123), idSeed: 5 });
    const b = rollDrop({ stage: 7, rng: mulberry32(123), idSeed: 5 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('ilvl tracks the stage', () => {
    // boss stage always drops, so no seed luck needed
    const drop = rollDrop({ stage: 20, rng: mulberry32(1), idSeed: 1 });
    expect(drop?.ilvl).toBe(20);
  });

  it('deeper / rarer items are worth more', () => {
    let earlyCommon = 0;
    let lateAny = 0;
    for (let i = 0; i < 60; i++) {
      const e = rollDrop({ stage: 2, rng: mulberry32(i), idSeed: i });
      const l = rollDrop({ stage: 30, rng: mulberry32(i + 999), idSeed: i });
      if (e) earlyCommon = Math.max(earlyCommon, itemValue(e));
      if (l) lateAny = Math.max(lateAny, itemValue(l));
    }
    expect(lateAny).toBeGreaterThan(earlyCommon);
  });
});
