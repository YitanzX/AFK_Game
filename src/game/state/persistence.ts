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
export const SAVE_VERSION = 3 as const;

export interface SaveV3 {
  version: 3;
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
  /** ms timestamp of the last write. */
  lastActiveAt: number;
}

export type Save = SaveV3;

export function freshSave(now = Date.now()): SaveV3 {
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
    skills: coerceSkills(o.skills),
  };
}

function coerceSkills(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = Math.max(0, Math.floor(numberOr(val, 0)));
      if (n > 0) out[k] = n;
    }
  }
  return out;
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

function coerceParty(v: unknown, roster: RosterUnit[]): PartySlot[] {
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
      if (slots.length >= MAX_PARTY) break;
    }
  }
  if (slots.length === 0) {
    // Fall back to the first roster entries (warrior front, others back).
    for (const r of roster.slice(0, MAX_PARTY)) {
      slots.push({ classId: r.classId, line: r.classId === 'warrior' ? 'front' : 'back' });
    }
  }
  return slots;
}

/** Normalise any recognised save shape (v1-v3) to a valid SaveV3. */
export function coerce(raw: unknown): SaveV3 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 && o.version !== 2 && o.version !== 3) return null;
  if (!Array.isArray(o.roster)) return null;

  const roster = o.roster
    .map(coerceRosterUnit)
    .filter((r): r is RosterUnit => r !== null);
  if (roster.length === 0) return null;

  const base = freshSave();
  const inventory = Array.isArray(o.inventory) ? o.inventory.filter(isItem) : [];
  const fragments: Record<string, number> = {};
  if (o.fragments && typeof o.fragments === 'object') {
    for (const [k, val] of Object.entries(o.fragments as Record<string, unknown>)) {
      fragments[k] = Math.max(0, Math.floor(numberOr(val, 0)));
    }
  }

  return {
    version: SAVE_VERSION,
    seed: typeof o.seed === 'number' ? o.seed >>> 0 : base.seed,
    locale: isLocale(o.locale) ? o.locale : base.locale,
    gold: Math.max(0, Math.floor(numberOr(o.gold, 0))),
    farmingStage: Math.max(1, Math.floor(numberOr(o.farmingStage, 1))),
    maxStageCleared: Math.max(0, Math.floor(numberOr(o.maxStageCleared, 0))),
    stageAttempt: Math.max(1, Math.floor(numberOr(o.stageAttempt, 1))),
    roster,
    party: coerceParty(o.party, roster),
    inventory,
    fragments,
    totalKills: Math.max(0, Math.floor(numberOr(o.totalKills, 0))),
    lastActiveAt: numberOr(o.lastActiveAt, Date.now()),
  };
}

// --- io ---------------------------------------------------------------

export function loadSave(): SaveV3 {
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
export function writeSaveNow(save: SaveV3): void {
  try {
    save.lastActiveAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    lastWrite = performance.now();
  } catch {
    /* storage unavailable - ignore */
  }
}

/** Throttled write (at most once per `minIntervalMs`). */
export function writeSaveThrottled(save: SaveV3, minIntervalMs = 5000): void {
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
