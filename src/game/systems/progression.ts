/**
 * Character XP / level-up and stage-clear reward maths.
 * Operates on plain RosterUnit data so it is easy to test and to call from the
 * store after a combat resolves.
 */

import type { RosterUnit } from '../core/types';
import { xpForLevel } from '../core/formulas';

export const MAX_LEVEL = 200;

export interface XpResult {
  roster: RosterUnit[];
  /** roster indices that gained at least one level. */
  leveledUp: number[];
}

/** Grant `amount` XP to every roster member, rolling over into levels. */
export function grantXpToRoster(roster: RosterUnit[], amount: number): XpResult {
  const leveledUp: number[] = [];
  const next = roster.map((unit, index) => {
    let { level, xp } = unit;
    xp += Math.max(0, Math.round(amount));
    let gained = false;

    while (level < MAX_LEVEL && xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
      gained = true;
    }
    if (level >= MAX_LEVEL) xp = 0;
    if (gained) leveledUp.push(index);

    return { ...unit, level, xp };
  });

  return { roster: next, leveledUp };
}

