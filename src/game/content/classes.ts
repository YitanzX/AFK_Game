/**
 * Class definitions. Only `warrior` and `mage` are used by the M1 starter party,
 * but `priest` and `rogue` are defined so M2 can wire them in without touching
 * the simulation.
 *
 * A class provides base stats at level 1 plus a per-level growth block that is
 * added on every level up. Range/attackSpeed/moveSpeed are treated as constant
 * for now (equipment and skills will modify them later).
 */

import type { Stats } from '../core/types';

export interface ClassDef {
  id: string;
  /** i18n key for the display name, e.g. `class.warrior`. */
  nameKey: string;
  /** Rough archetype tag for the renderer / UI. */
  role: 'tank' | 'melee' | 'ranged' | 'healer';
  base: Stats;
  /** Added to the corresponding base stat for each level above 1. */
  growth: Pick<Stats, 'maxHp' | 'atk' | 'def'>;
}

export const CLASSES: Record<string, ClassDef> = {
  warrior: {
    id: 'warrior',
    nameKey: 'class.warrior',
    role: 'tank',
    base: {
      maxHp: 220,
      atk: 16,
      def: 12,
      attackSpeed: 0.9,
      range: 6,
      moveSpeed: 26,
      critChance: 0.05,
      critDmg: 1.5,
    },
    growth: { maxHp: 42, atk: 4.2, def: 2.8 },
  },

  mage: {
    id: 'mage',
    nameKey: 'class.mage',
    role: 'ranged',
    base: {
      maxHp: 110,
      atk: 30,
      def: 4,
      attackSpeed: 0.7,
      range: 70,
      moveSpeed: 20,
      critChance: 0.08,
      critDmg: 1.7,
    },
    growth: { maxHp: 22, atk: 6.6, def: 1.1 },
  },

  // --- defined for M2, not spawned yet -------------------------------------
  priest: {
    id: 'priest',
    nameKey: 'class.priest',
    role: 'healer',
    base: {
      maxHp: 130,
      atk: 14,
      def: 5,
      attackSpeed: 0.8,
      range: 60,
      moveSpeed: 20,
      critChance: 0.04,
      critDmg: 1.5,
    },
    growth: { maxHp: 20, atk: 2.4, def: 1 },
  },

  rogue: {
    id: 'rogue',
    nameKey: 'class.rogue',
    role: 'melee',
    base: {
      maxHp: 140,
      atk: 22,
      def: 6,
      attackSpeed: 1.4,
      range: 6,
      moveSpeed: 34,
      critChance: 0.2,
      critDmg: 2.0,
    },
    growth: { maxHp: 20, atk: 4.2, def: 1.2 },
  },
};

/** Stat block for a class at a given level. */
export function statsForLevel(classId: string, level: number): Stats {
  const def = CLASSES[classId];
  if (!def) throw new Error(`Unknown class: ${classId}`);
  const lvls = Math.max(0, level - 1);
  return {
    ...def.base,
    maxHp: Math.round(def.base.maxHp + def.growth.maxHp * lvls),
    atk: Math.round(def.base.atk + def.growth.atk * lvls),
    def: Math.round(def.base.def + def.growth.def * lvls),
  };
}

/** The starting party for a fresh save. */
export const STARTER_ROSTER: { classId: string; level: number; xp: number }[] = [
  { classId: 'warrior', level: 1, xp: 0 },
  { classId: 'mage', level: 1, xp: 0 },
];
