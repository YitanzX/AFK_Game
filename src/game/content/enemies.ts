/**
 * Enemy templates. Base stats are for stage 1; `enemyScaling(stage)` multiplies
 * hp and atk as the player pushes further.
 */

import type { Stats } from '../core/types';
import { enemyScaling, rewardScaling } from '../core/formulas';

export interface EnemyDef {
  id: string;
  nameKey: string;
  role: 'melee' | 'ranged';
  /** Full stat block at stage 1 (hp/atk get scaled per stage). */
  base: Stats;
  /** Gold dropped when this enemy dies, at stage 1 (scaled by `rewardScaling`). */
  gold: number;
  /** XP granted to every party member when this enemy dies, at stage 1. */
  xp: number;
  /** Hero fragments dropped when this enemy dies (flat, not stage-scaled). */
  fragments: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  goblin: {
    id: 'goblin',
    nameKey: 'enemy.goblin',
    role: 'melee',
    base: {
      maxHp: 70,
      atk: 10,
      def: 3,
      attackSpeed: 1.0,
      range: 6,
      moveSpeed: 30,
      critChance: 0.03,
      critDmg: 1.5,
    },
    gold: 12,
    xp: 16,
    fragments: 1,
  },

  archer: {
    id: 'archer',
    nameKey: 'enemy.archer',
    role: 'ranged',
    base: {
      maxHp: 55,
      atk: 14,
      def: 2,
      attackSpeed: 0.8,
      range: 55,
      moveSpeed: 22,
      critChance: 0.05,
      critDmg: 1.6,
    },
    gold: 16,
    xp: 22,
    fragments: 1,
  },

  orc: {
    id: 'orc',
    nameKey: 'enemy.orc',
    role: 'melee',
    base: {
      maxHp: 160,
      atk: 18,
      def: 7,
      attackSpeed: 0.8,
      range: 7,
      moveSpeed: 24,
      critChance: 0.04,
      critDmg: 1.6,
    },
    gold: 30,
    xp: 40,
    fragments: 2,
  },

  ogre: {
    id: 'ogre',
    nameKey: 'enemy.ogre',
    role: 'melee',
    base: {
      maxHp: 620,
      atk: 27,
      def: 12,
      attackSpeed: 0.6,
      range: 9,
      moveSpeed: 18,
      critChance: 0.05,
      critDmg: 1.8,
    },
    gold: 400,
    xp: 500,
    fragments: 20,
  },
};

/** Concrete stats for an enemy template at a given stage. */
export function enemyStatsForStage(enemyId: string, stage: number): Stats {
  const def = ENEMIES[enemyId];
  if (!def) throw new Error(`Unknown enemy: ${enemyId}`);
  const mult = enemyScaling(stage);
  return {
    ...def.base,
    maxHp: Math.round(def.base.maxHp * mult),
    atk: Math.round(def.base.atk * mult),
  };
}

/** Gold + XP dropped by an enemy template at a given stage. */
export function enemyBounty(enemyId: string, stage: number): { gold: number; xp: number } {
  const def = ENEMIES[enemyId];
  if (!def) throw new Error(`Unknown enemy: ${enemyId}`);
  const mult = rewardScaling(stage);
  return {
    gold: Math.max(1, Math.round(def.gold * mult)),
    xp: Math.max(1, Math.round(def.xp * mult)),
  };
}
