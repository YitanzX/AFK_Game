import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  totalXpForLevel,
  enemyScaling,
  basicDamage,
  rewardScaling,
} from '../core/formulas';
import { mulberry32 } from '../core/rng';

describe('xp curve', () => {
  it('is positive and strictly increasing', () => {
    for (let n = 1; n < 50; n++) {
      expect(xpForLevel(n)).toBeGreaterThan(0);
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });

  it('totalXpForLevel is the running sum of xpForLevel', () => {
    expect(totalXpForLevel(1)).toBe(0);
    for (let n = 1; n < 30; n++) {
      expect(totalXpForLevel(n + 1) - totalXpForLevel(n)).toBe(xpForLevel(n));
    }
  });
});

describe('enemyScaling', () => {
  it('is 1 at stage 1 and grows with stage', () => {
    expect(enemyScaling(1)).toBe(1);
    for (let s = 1; s < 40; s++) {
      expect(enemyScaling(s + 1)).toBeGreaterThan(enemyScaling(s));
    }
  });
});

describe('basicDamage', () => {
  it('never returns less than 1 even against huge defence', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const { amount } = basicDamage(5, 9999, { rng, critChance: 0, critDmg: 2 });
      expect(amount).toBeGreaterThanOrEqual(1);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      expect(basicDamage(20, 10, { rng: a, critChance: 0.3, critDmg: 2 })).toEqual(
        basicDamage(20, 10, { rng: b, critChance: 0.3, critDmg: 2 }),
      );
    }
  });

  it('crits hit harder on average', () => {
    const noCrit = mulberry32(7);
    const allCrit = mulberry32(7);
    let sumNo = 0;
    let sumCrit = 0;
    for (let i = 0; i < 500; i++) {
      sumNo += basicDamage(30, 10, { rng: noCrit, critChance: 0, critDmg: 2 }).amount;
      sumCrit += basicDamage(30, 10, { rng: allCrit, critChance: 1, critDmg: 2 }).amount;
    }
    expect(sumCrit).toBeGreaterThan(sumNo * 1.5);
  });
});

describe('rewardScaling', () => {
  it('is 1 at stage 1 and outpaces enemyScaling as stages climb', () => {
    expect(rewardScaling(1)).toBe(1);
    for (let s = 1; s < 40; s++) {
      expect(rewardScaling(s + 1)).toBeGreaterThan(rewardScaling(s));
    }
    // Deeper stages must be the better farm: rewards grow faster than difficulty.
    expect(rewardScaling(20) / rewardScaling(1)).toBeGreaterThan(enemyScaling(20) / enemyScaling(1));
  });
});
