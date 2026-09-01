/**
 * localStorage save/load. Everything is wrapped in try/catch so a private-mode
 * browser, cleared storage or corrupt JSON degrades to a fresh game instead of
 * throwing. `version` + `migrate` give us room to evolve the schema later.
 */

import type { RosterUnit } from '../core/types';
import { STARTER_ROSTER } from '../content/classes';
import { isLocale, type Locale } from '../../i18n';

export const SAVE_KEY = 'project_afk_save';
export const SAVE_VERSION = 1 as const;

export interface SaveV1 {
  version: 1;
  /** Stable per-save RNG seed (drives combat seeds). */
  seed: number;
  locale: Locale;
  gold: number;
  /** Stage the party is currently attempting / farming. */
  farmingStage: number;
  /** Highest stage fully cleared. */
  maxStageCleared: number;
  /** Retry counter for the current stage (affects the combat seed). */
  stageAttempt: number;
  roster: RosterUnit[];
  /** Lifetime enemies defeated. */
  totalKills: number;
  /** ms timestamp of the last write. */
  lastActiveAt: number;
}

export type AnySave = SaveV1;

export function freshSave(now = Date.now()): SaveV1 {
  return {
    version: SAVE_VERSION,
    seed: (Math.random() * 0xffffffff) >>> 0,
    locale: 'es',
    gold: 0,
    farmingStage: 1,
    maxStageCleared: 0,
    stageAttempt: 1,
    roster: STARTER_ROSTER.map((r) => ({ ...r })),
    totalKills: 0,
    lastActiveAt: now,
  };
}

/** Bring any older save shape up to the current version. */
function migrate(raw: AnySave): SaveV1 {
  // Only v1 exists today; this is where future `raw.version === 1 -> 2` goes.
  return raw;
}

function isRosterUnit(v: unknown): v is RosterUnit {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as RosterUnit).classId === 'string' &&
    typeof (v as RosterUnit).level === 'number' &&
    typeof (v as RosterUnit).xp === 'number'
  );
}

function coerce(raw: unknown): SaveV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (!Array.isArray(o.roster) || !o.roster.every(isRosterUnit)) return null;

  const base = freshSave();
  return {
    version: 1,
    seed: typeof o.seed === 'number' ? o.seed >>> 0 : base.seed,
    locale: isLocale(o.locale) ? o.locale : base.locale,
    gold: numberOr(o.gold, 0),
    farmingStage: Math.max(1, Math.floor(numberOr(o.farmingStage, 1))),
    maxStageCleared: Math.max(0, Math.floor(numberOr(o.maxStageCleared, 0))),
    stageAttempt: Math.max(1, Math.floor(numberOr(o.stageAttempt, 1))),
    roster: o.roster as RosterUnit[],
    totalKills: Math.max(0, Math.floor(numberOr(o.totalKills, 0))),
    lastActiveAt: numberOr(o.lastActiveAt, Date.now()),
  };
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function loadSave(): SaveV1 {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return freshSave();
    const parsed = coerce(JSON.parse(text));
    if (!parsed) return freshSave();
    return migrate(parsed);
  } catch {
    return freshSave();
  }
}

let lastWrite = 0;

/** Write immediately, ignoring the throttle. Use on tab hide / unload. */
export function writeSaveNow(save: SaveV1): void {
  try {
    save.lastActiveAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    lastWrite = performance.now();
  } catch {
    /* storage unavailable - ignore */
  }
}

/** Throttled write (at most once per `minIntervalMs`). */
export function writeSaveThrottled(save: SaveV1, minIntervalMs = 5000): void {
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
