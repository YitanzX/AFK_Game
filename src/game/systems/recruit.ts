/**
 * Hero recruitment via fragments. Enemies drop fragments; they pile up toward
 * the next locked class in `RECRUIT_ORDER`. On reaching the threshold the class
 * is unlocked (added to the roster) and any leftover cascades to the next one.
 *
 * Deterministic - no RNG - so it is trivial to test and to run for offline gains.
 */

import type { PartySlot, RosterUnit } from '../core/types';
import { emptyEquipment } from '../core/types';
import { CLASSES, MAX_PARTY } from '../content/classes';

/** Order in which locked classes accept fragments and unlock. */
export const RECRUIT_ORDER = ['priest', 'rogue'] as const;

const RECRUIT_COST: Record<string, number> = {
  priest: 60,
  rogue: 150,
};

export function recruitCost(classId: string): number {
  return RECRUIT_COST[classId] ?? 200;
}

export function isUnlocked(roster: RosterUnit[], classId: string): boolean {
  return roster.some((u) => u.classId === classId);
}

/** The next class still waiting on fragments, or null if all are unlocked. */
export function nextLockedClass(roster: RosterUnit[]): string | null {
  for (const id of RECRUIT_ORDER) if (!isUnlocked(roster, id)) return id;
  return null;
}

export interface FragmentResult {
  roster: RosterUnit[];
  party: PartySlot[];
  fragments: Record<string, number>;
  /** classIds unlocked by this call (in order). */
  recruited: string[];
}

function averagePartyLevel(roster: RosterUnit[], party: PartySlot[]): number {
  const fielded = party
    .map((s) => roster.find((u) => u.classId === s.classId))
    .filter((u): u is RosterUnit => !!u);
  if (fielded.length === 0) return 1;
  return fielded.reduce((sum, u) => sum + u.level, 0) / fielded.length;
}

/**
 * Add `amount` fragments toward the next locked class, unlocking (and cascading
 * leftovers) as thresholds are crossed. Pure: returns new roster/party/fragments.
 */
export function applyFragments(
  roster: RosterUnit[],
  party: PartySlot[],
  fragments: Record<string, number>,
  amount: number,
): FragmentResult {
  let nextRoster = roster;
  let nextParty = party;
  const nextFrags: Record<string, number> = { ...fragments };
  const recruited: string[] = [];

  let pool = Math.max(0, Math.round(amount));

  while (pool > 0) {
    const target = nextLockedClass(nextRoster);
    if (!target) break; // everything unlocked - fragments are wasted

    const have = (nextFrags[target] ?? 0) + pool;
    const cost = recruitCost(target);

    if (have < cost) {
      nextFrags[target] = have;
      pool = 0;
      break;
    }

    // Unlock this class, carry the remainder to the next one.
    nextFrags[target] = 0;
    pool = have - cost;

    const level = Math.max(1, Math.floor(averagePartyLevel(nextRoster, nextParty) * 0.6));
    const hero: RosterUnit = {
      classId: target,
      level,
      xp: 0,
      equipment: emptyEquipment(),
      skills: {},
    };
    nextRoster = [...nextRoster, hero];
    recruited.push(target);

    // Field the newcomer if there's a free party slot.
    if (nextParty.length < MAX_PARTY) {
      const line = CLASSES[target]?.role === 'tank' || CLASSES[target]?.role === 'melee'
        ? 'front'
        : 'back';
      nextParty = [...nextParty, { classId: target, line }];
    }
  }

  return { roster: nextRoster, party: nextParty, fragments: nextFrags, recruited };
}
