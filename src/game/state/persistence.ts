/**
 * localStorage save/load. Everything is wrapped in try/catch so a private-mode
 * browser, cleared storage or corrupt JSON degrades to a fresh game instead of
 * throwing. `version` + `coerce` normalise any recognised older shape up to the
 * current schema.
 */

import type { Item } from '../core/items';
import { ITEM_SLOTS, RARITIES } from '../core/items';
import type { PartySlot, RosterUnit } from '../core/types';
import { starterRoster, defaultParty, MAX_PARTY } from '../content/classes';
import { isLocale, type Locale } from '../../i18n';

export const SAVE_KEY = 'project_afk_save';
export const SAVE_VERSION = 4 as const;

export interface SaveV4 {
  version: 4;
  /** Stable per-save RNG seed (drives combat & loot seeds). */
  seed: number;
  locale: Locale;
  gold: number;
  /** Stage the party is currently attempting. */
  farmingStage: number;
  /** Highest stage fully cleared. */
  maxStageCleared: number;
  /** Retry counter for the current stage (affects the combat seed). */
  stageAttempt: number;
  /** All unlocked heroes (at most one per classId). */
  roster: RosterUnit[];
  /** Active party: ordered subset of roster classIds, max 4. */
  party: PartySlot[];
  /** Unequipped items. */
  inventory: Item[];
  /** Fragment progress toward each still-locked class. */
  fragments: Record<string, number>;
  /** Lifetime enemies defeated. */
  totalKills: number;

  // --- M4: meta tree + prestige ---
  /** Meta skill tree node ranks (gold-bought, persists through prestige). */
  metaTree: Record<string, number>;
  /** Unspent prestige currency. */
  relics: number;
  /** Prestige upgrade ranks. */
  prestigeUpgrades: Record<string, number>;
  /** How many times the player has prestiged. */
  prestigeCount: number;
  /** Highest stage ever reached, across all prestiges (prestige payout + display). */
  bestStageEver: number;

  /** ms timestamp of the last write. */
  lastActiveAt: number;
}

export type Save = SaveV4;

export function freshSave(now = Date.now()): SaveV4 {
  return {
    version: SAVE_VERSION,
    seed: (Math.random() * 0xffffffff) >>> 0,
    locale: 'es',
    gold: 0,
    farmingStage: 1,
    maxStageCleared: 0,
    stageAttempt: 1,
    roster: starterRoster(),
    party: defaultParty(),
    inventory: [],
    fragments: {},
    totalKills: 0,
    metaTree: {},
    relics: 0,
    prestigeUpgrades: {},
    prestigeCount: 0,
    bestStageEver: 0,
    lastActiveAt: now,
  };
}

// --- validation helpers --------------------------------------------------

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function coerceRosterUnit(v: unknown): RosterUnit | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.classId !== 'string') return null;
  const eq = (o.equipment ?? {}) as Record<string, unknown>;
  const slot = (s: 'weapon' | 'armor' | 'accessory') =>
    isItem(eq[s]) ? (eq[s] as Item) : null;
  return {
    classId: o.classId,
    level: Math.max(1, Math.floor(numberOr(o.level, 1))),
    xp: Math.max(0, Math.floor(numberOr(o.xp, 0))),
    equipment: { weapon: slot('weapon'), armor: slot('armor'), accessory: slot('accessory') },
    skills: coerceRanks(o.skills),
  };
}

function isItem(v: unknown): v is Item {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    ITEM_SLOTS.includes(o.slot as Item['slot']) &&
    RARITIES.includes(o.rarity as Item['rarity']) &&
    typeof o.ilvl === 'number' &&
    Array.isArray(o.affixes)
  );
}

function coerceParty(v: unknown, roster: RosterUnit[], cap: number): PartySlot[] {
  const known = new Set(roster.map((r) => r.classId));
  const seen = new Set<string>();
  const slots: PartySlot[] = [];
  if (Array.isArray(v)) {
    for (const raw of v) {
      const o = raw as Record<string, unknown>;
      const classId = typeof o?.classId === 'string' ? o.classId : null;
      if (!classId || !known.has(classId) || seen.has(classId)) continue;
      seen.add(classId);
      slots.push({ classId, line: o.line === 'front' ? 'front' : 'back' });
      if (slots.length >= cap) break;
    }
  }
  if (slots.length === 0) {
    for (const r of roster.slice(0, cap)) {
      slots.push({ classId: r.classId, line: r.classId === 'warrior' ? 'front' : 'back' });
    }
  }
  return slots;
}

function coerceRanks(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = Math.max(0, Math.floor(numberOr(val, 0)));
      if (n > 0) out[k] = n;
    }
  }
  return out;
}

/** Normalise any recognised save shape (v1-v4) to a valid SaveV4. */
export function coerce(raw: unknown): SaveV4 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (![1, 2, 3, 4].includes(o.version as number)) return null;
  if (!Array.isArray(o.roster)) return null;

  const roster = o.roster
    .map(coerceRosterUnit)
    .filter((r): r is RosterUnit => r !== null);
  if (roster.length === 0) return null;

  const base = freshSave();
  const inventory = Array.isArray(o.inventory) ? o.inventory.filter(isItem) : [];
  const fragments = coerceRanks(o.fragments);
  const metaTree = coerceRanks(o.metaTree);
  const prestigeUpgrades = coerceRanks(o.prestigeUpgrades);

  // party cap grows with the meta tree's `meta_slot` node
  const slotRank = metaTree.meta_slot ?? 0;

  return {
    version: SAVE_VERSION,
    seed: typeof o.seed === 'number' ? o.seed >>> 0 : base.seed,
    locale: isLocale(o.locale) ? o.locale : base.locale,
    gold: Math.max(0, Math.floor(numberOr(o.gold, 0))),
    farmingStage: Math.max(1, Math.floor(numberOr(o.farmingStage, 1))),
    maxStageCleared: Math.max(0, Math.floor(numberOr(o.maxStageCleared, 0))),
    stageAttempt: Math.max(1, Math.floor(numberOr(o.stageAttempt, 1))),
    roster,
    party: coerceParty(o.party, roster, MAX_PARTY + slotRank),
    inventory,
    fragments,
    totalKills: Math.max(0, Math.floor(numberOr(o.totalKills, 0))),
    metaTree,
    relics: Math.max(0, Math.floor(numberOr(o.relics, 0))),
    prestigeUpgrades,
    prestigeCount: Math.max(0, Math.floor(numberOr(o.prestigeCount, 0))),
    bestStageEver: Math.max(
      0,
      Math.floor(numberOr(o.bestStageEver, numberOr(o.maxStageCleared, 0))),
    ),
    lastActiveAt: numberOr(o.lastActiveAt, Date.now()),
  };
}

// --- io ---------------------------------------------------------------

export function loadSave(): SaveV4 {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return freshSave();
    return coerce(JSON.parse(text)) ?? freshSave();
  } catch {
    return freshSave();
  }
}

let lastWrite = 0;

/** Write immediately, ignoring the throttle. Use on tab hide / unload. */
export function writeSaveNow(save: SaveV4): void {
  try {
    save.lastActiveAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    lastWrite = performance.now();
  } catch {
    /* storage unavailable - ignore */
  }
}

/** Throttled write (at most once per `minIntervalMs`). */
export function writeSaveThrottled(save: SaveV4, minIntervalMs = 5000): void {
  const now = performance.now();
  if (now - lastWrite < minIntervalMs) return;
  writeSaveNow(save);
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
