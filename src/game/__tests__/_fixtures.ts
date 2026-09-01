import type { PartySlot, ResolvedHero, RosterUnit } from '../core/types';
import { emptyEquipment } from '../core/types';
import { resolveParty } from '../state/store';

/** A RosterUnit with no gear. */
export function hero(classId: string, level = 1, xp = 0): RosterUnit {
  return { classId, level, xp, equipment: emptyEquipment() };
}

export const STARTER_ROSTER: RosterUnit[] = [hero('warrior'), hero('mage')];

export const STARTER_PARTY: PartySlot[] = [
  { classId: 'warrior', line: 'front' },
  { classId: 'mage', line: 'back' },
];

/** Resolved starter party (derived stats) for the simulation / afk maths. */
export function starterResolvedParty(): ResolvedHero[] {
  return resolveParty(STARTER_ROSTER, STARTER_PARTY);
}
