/**
 * All the tunable maths in one place: XP curve, enemy scaling, damage, rewards.
 * Pure functions, no state, easy to unit-test and later feed with meta bonuses.
 */

import type { Stats } from './types';
import type { Rng } from './rng';

/** XP required to go from level `n` to `n + 1`. */
export function xpForLevel(n: number): number {
  return Math.floor(80 * Math.pow(n, 1.5));
}

/** Lifetime XP needed to *reach* level `n` (level 1 = 0). */
export function totalXpForLevel(n: number): number {
  let total = 0;
  for (let i = 1; i < n; i++) total += xpForLevel(i);
  return total;
}

/** Multiplier applied to base enemy hp/atk for a given stage (stage 1 = x1). */
export function enemyScaling(stage: number): number {
  return Math.pow(1.1, stage - 1);
}

/**
 * Basic attack damage. Diminishing returns from defence, small variance,
 * optional crit. Never returns less than 1.
 */
export function basicDamage(
  atk: number,
  def: number,
  opts: { rng: Rng; critChance: number; critDmg: number },
): { amount: number; crit: boolean } {
  const mitigation = atk * (atk / (atk + def * 4));
  const variance = 0.9 + opts.rng.next() * 0.2; // 0.9 .. 1.1
  const crit = opts.rng.chance(opts.critChance);
  const raw = mitigation * variance * (crit ? opts.critDmg : 1);
  return { amount: Math.max(1, Math.round(raw)), crit };
}

/** Estimated combat power of a stat block. */
export function combatPower(stats: Stats): number {
  return stats.maxHp * 0.5 + stats.atk * stats.attackSpeed * 6 + stats.def * 2;
}

/**
 * Multiplier on an enemy's base gold/xp bounty for a given stage. Grows a touch
 * faster than `enemyScaling` so deeper stages are always the better farm.
 */
export function rewardScaling(stage: number): number {
  return Math.pow(1.13, Math.max(1, stage) - 1);
}

/** Hard cap on how much offline time is rewarded. */
export const AFK_CAP_SECONDS = 12 * 60 * 60;
