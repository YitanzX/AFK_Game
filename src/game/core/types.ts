/**
 * Core data types shared by the simulation, systems and UI.
 *
 * The simulation deals in *logical* battlefield coordinates (see BATTLEFIELD).
 * The canvas renderer scales those to pixels.
 */

import type { Item, ItemSlot } from './items';

export type Team = 'ally' | 'enemy';

export type Outcome = 'ongoing' | 'victory' | 'defeat';

/** Logical battlefield size. Allies enter from the left, enemies from the right. */
export const BATTLEFIELD = { width: 200, height: 100 } as const;

/** Combat-relevant stats. Kept flat and numeric so they are trivial to derive/sum. */
export interface Stats {
  maxHp: number;
  atk: number;
  def: number;
  /** Attacks per second. Attack cooldown = 1 / attackSpeed. */
  attackSpeed: number;
  /** Attack range in logical units. */
  range: number;
  /** Movement speed in logical units per second. */
  moveSpeed: number;
  /** 0..1 chance for an attack to crit. */
  critChance: number;
  /** Crit damage multiplier, e.g. 1.5 = +50%. */
  critDmg: number;
}

/** A live combat participant. Mutated in place by the simulation each tick. */
export interface Unit {
  id: string;
  team: Team;
  /** classId for allies, enemyId for enemies. Used by the renderer for colour/shape. */
  kind: string;
  /** Display name (already localised or a class key the UI resolves). */
  name: string;
  /** Party index for allies so results can be written back. -1 for enemies. */
  rosterIndex: number;
  /** Character level for allies (drives class traits); 0 for enemies. */
  level: number;

  x: number;
  y: number;

  hp: number;
  stats: Stats;

  /** Seconds until this unit can attack again. */
  attackCd: number;
  /** Current target unit id, or null. */
  targetId: string | null;
  /** True once hp <= 0. Dead units are kept for one extra tick for the renderer. */
  dead: boolean;

  /** Gold awarded when this unit dies (enemies only; 0 for allies). */
  goldValue: number;
  /** XP awarded to every party member when this unit dies (enemies only). */
  xpValue: number;

  /** Reserved for M3 skills. Unused in M1. */
  skillCds: Record<string, number>;
}

export interface Projectile {
  id: string;
  team: Team;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
  /** Logical units per second. */
  speed: number;
  damage: number;
  crit: boolean;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: 'damage' | 'crit' | 'heal';
  /** Seconds remaining before it disappears. */
  ttl: number;
}

export interface CombatState {
  stage: number;
  attempt: number;
  /** 1-based index of the wave currently being fought. */
  wave: number;
  totalWaves: number;

  units: Unit[];
  projectiles: Projectile[];
  floaters: FloatingText[];

  outcome: Outcome;
  /** Total simulated seconds since the combat started. */
  elapsed: number;

  /** Rewards accumulated this combat, purely from enemies killed. Never decreases. */
  rewards: { gold: number; xp: number };
  /** Enemies killed this combat. */
  kills: number;
  /** Hero fragments dropped this combat (from enemy kills). Never decreases. */
  fragments: number;

  /** Monotonic id counter for spawned entities. */
  nextId: number;
}

/** What a hero has equipped. Slot keys match `ItemSlot`. */
export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  accessory: Item | null;
}

export function emptyEquipment(): Equipment {
  return { weapon: null, armor: null, accessory: null };
}

/** Persistent per-character data (the roster). At most one per classId. */
export interface RosterUnit {
  classId: string;
  level: number;
  /** XP accumulated toward the next level (not lifetime XP). */
  xp: number;
  equipment: Equipment;
}

/** A slot in the active party (subset of the roster, max 4). */
export interface PartySlot {
  classId: string;
  line: 'front' | 'back';
}

/** A party member resolved for the simulation: derived stats + placement. */
export interface ResolvedHero {
  classId: string;
  line: 'front' | 'back';
  /** Index in the active party array; written back as `Unit.rosterIndex`. */
  partyIndex: number;
  level: number;
  stats: Stats;
}

export type { Item, ItemSlot };

/** Reward rate while farming a stage, measured from a headless simulation. */
export interface FarmRates {
  goldPerSec: number;
  xpPerSec: number;
}
