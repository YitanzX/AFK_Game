/**
 * Offline progress. Rewards are earned only by defeating enemies, so the offline
 * grant is "how many enemies would the party have killed while away" - which we
 * get by actually running the farm stage headlessly once and measuring the
 * gold/xp per second, then multiplying by the (capped) time away.
 */

import type { FarmRates, ResolvedHero } from '../core/types';
import { createCombat, stepCombat } from '../core/simulation';
import { mulberry32, hashSeed } from '../core/rng';
import { TICK_SECONDS } from '../core/loop';
import { AFK_CAP_SECONDS } from '../core/formulas';

/** Simulated seconds to observe when measuring a farm rate. */
const SAMPLE_SECONDS = 120;

/**
 * Run the given stage headlessly and measure the reward rate the party sustains
 * on it (gold/xp per real second, from kills only). If the party can't clear it
 * the rate simply reflects the partial kills before the wipe.
 */
export function estimateFarmRates(input: {
  seed: number;
  stage: number;
  party: ResolvedHero[];
}): FarmRates {
  if (input.party.length === 0) return { goldPerSec: 0, xpPerSec: 0 };

  const rng = mulberry32(hashSeed(input.seed, input.stage, 1));
  const mk = () => createCombat({ party: input.party, stage: input.stage, attempt: 1 });
  const state = mk();
  const maxTicks = Math.round(SAMPLE_SECONDS / TICK_SECONDS);

  let ticks = 0;
  let gold = 0;
  let xp = 0;
  while (ticks < maxTicks) {
    stepCombat(state, TICK_SECONDS, rng);
    ticks++;
    if (state.outcome === 'victory') {
      gold += state.rewards.gold;
      xp += state.rewards.xp;
      Object.assign(state, mk()); // keep sampling a steady farm loop
    } else if (state.outcome === 'defeat') {
      break;
    }
  }
  gold += state.rewards.gold;
  xp += state.rewards.xp;

  const seconds = Math.max(TICK_SECONDS, ticks * TICK_SECONDS);
  return { goldPerSec: gold / seconds, xpPerSec: xp / seconds };
}

export interface OfflineProgress {
  /** Seconds actually rewarded (after clamping to the cap). */
  seconds: number;
  /** Real seconds elapsed before clamping. */
  elapsedSeconds: number;
  gold: number;
  /** XP granted to each roster member. */
  xp: number;
  capped: boolean;
}

export interface OfflineInput {
  /** ms timestamp of the last save. */
  lastActiveAt: number;
  /** Current wall-clock time in ms. */
  now: number;
  /** Reward rate the party sustains on its farm stage (from `estimateFarmRates`). */
  rates: FarmRates;
  /** Optional reward multipliers from the meta tree (M4). */
  multipliers?: { gold?: number; xp?: number };
  /** Optional override of the cap (meta tree can raise it). */
  capSeconds?: number;
}

export function computeOfflineProgress(input: OfflineInput): OfflineProgress {
  const cap = input.capSeconds ?? AFK_CAP_SECONDS;
  const elapsedSeconds = Math.max(0, (input.now - input.lastActiveAt) / 1000);
  const seconds = Math.min(elapsedSeconds, cap);

  const goldMult = input.multipliers?.gold ?? 1;
  const xpMult = input.multipliers?.xp ?? 1;

  return {
    seconds,
    elapsedSeconds,
    gold: Math.floor(input.rates.goldPerSec * seconds * goldMult),
    xp: Math.floor(input.rates.xpPerSec * seconds * xpMult),
    capped: elapsedSeconds > cap,
  };
}
