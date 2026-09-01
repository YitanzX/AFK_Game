import { describe, it, expect } from 'vitest';
import { computeOfflineProgress, estimateFarmRates } from '../systems/afk';
import { AFK_CAP_SECONDS } from '../core/formulas';
import type { FarmRates } from '../core/types';
import { starterResolvedParty } from './_fixtures';

const HOUR = 3600 * 1000;
const RATES: FarmRates = { goldPerSec: 10, xpPerSec: 7 };
const PARTY = starterResolvedParty();

describe('estimateFarmRates', () => {
  it('reports a positive rate on an early, clearable stage', () => {
    const r = estimateFarmRates({ seed: 1, stage: 1, party: PARTY });
    expect(r.goldPerSec).toBeGreaterThan(0);
    expect(r.xpPerSec).toBeGreaterThan(0);
  });

  it('is zero with no party', () => {
    const r = estimateFarmRates({ seed: 1, stage: 1, party: [] });
    expect(r).toEqual({ goldPerSec: 0, xpPerSec: 0 });
  });

  it('is deterministic', () => {
    expect(estimateFarmRates({ seed: 5, stage: 2, party: PARTY })).toEqual(
      estimateFarmRates({ seed: 5, stage: 2, party: PARTY }),
    );
  });
});

describe('computeOfflineProgress', () => {
  it('rewards rate * time under the cap', () => {
    const now = 10 * HOUR;
    const r = computeOfflineProgress({ lastActiveAt: now - 2 * HOUR, now, rates: RATES });
    expect(r.capped).toBe(false);
    expect(r.seconds).toBeCloseTo(7200, 5);
    expect(r.gold).toBe(Math.floor(RATES.goldPerSec * 7200));
    expect(r.xp).toBe(Math.floor(RATES.xpPerSec * 7200));
  });

  it('clamps to the 12h cap and flags it', () => {
    const now = 100 * HOUR;
    const r = computeOfflineProgress({ lastActiveAt: now - 72 * HOUR, now, rates: RATES });
    expect(r.capped).toBe(true);
    expect(r.seconds).toBe(AFK_CAP_SECONDS);
    expect(r.elapsedSeconds).toBeGreaterThan(AFK_CAP_SECONDS);
  });

  it('never goes negative when the clock moved backwards', () => {
    const now = 5 * HOUR;
    const r = computeOfflineProgress({ lastActiveAt: now + HOUR, now, rates: RATES });
    expect(r.seconds).toBe(0);
    expect(r.gold).toBe(0);
    expect(r.xp).toBe(0);
    expect(r.capped).toBe(false);
  });

  it('applies reward multipliers', () => {
    const now = 10 * HOUR;
    const r = computeOfflineProgress({
      lastActiveAt: now - HOUR,
      now,
      rates: RATES,
      multipliers: { gold: 2, xp: 3 },
    });
    expect(r.gold).toBe(Math.floor(RATES.goldPerSec * 3600 * 2));
    expect(r.xp).toBe(Math.floor(RATES.xpPerSec * 3600 * 3));
  });
});
