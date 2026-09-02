/**
 * Character XP / level-up maths. Operates on plain RosterUnit data so it is easy
 * to test and to call from the store after a combat resolves.
 */

import type { RosterUnit } from '../core/types';
import { xpForLevel } from '../core/formulas';

export const MAX_LEVEL = 200;

export interface XpResult {
  roster: RosterUnit[];
  /** roster indices that gained at least one level. */
  leveledUp: number[];
}

function applyXp(unit: RosterUnit, amount: number): { unit: RosterUnit; gained: boolean } {
  let { level, xp } = unit;
  xp += Math.max(0, Math.round(amount));
  let gained = false;
  while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    gained = true;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { unit: { ...unit, level, xp }, gained };
}

/** Grant `amount` XP to every roster member. */
export function grantXpToRoster(roster: RosterUnit[], amount: number): XpResult {
  const leveledUp: number[] = [];
  const next = roster.map((unit, index) => {
    const r = applyXp(unit, amount);
    if (r.gained) leveledUp.push(index);
    return r.unit;
  });
  return { roster: next, leveledUp };
}

/**
 * Grant `amount` XP only to roster members whose classId is in `activeClassIds`
 * (the fielded party). Benched heroes are left untouched.
 *
 * `scaleFor` (optional) returns a per-hero multiplier on `amount` - used for the
 * level/stage catch-up scaling so an over-levelled hero gains less.
 */
export function grantXpToParty(
  roster: RosterUnit[],
  activeClassIds: readonly string[],
  amount: number,
  scaleFor?: (unit: RosterUnit) => number,
): XpResult {
  const active = new Set(activeClassIds);
  const leveledUp: number[] = [];
  const next = roster.map((unit, index) => {
    if (!active.has(unit.classId)) return unit;
    const scaled = amount * (scaleFor ? scaleFor(unit) : 1);
    const r = applyXp(unit, scaled);
    if (r.gained) leveledUp.push(index);
    return r.unit;
  });
  return { roster: next, leveledUp };
}
