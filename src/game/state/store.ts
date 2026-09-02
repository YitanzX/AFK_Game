/**
 * Central game store (Zustand). Holds the persisted save fields plus a little
 * session-only UI state, and exposes the actions that mutate them.
 *
 * The live combat simulation does NOT live here (it would cause 20 re-renders a
 * second) - see battleController.ts. The store is only touched when the battle
 * awards rewards or a stage is cleared/failed, or when the player manages the
 * party / inventory.
 */

import { create } from 'zustand';
import type { Item } from '../core/items';
import { itemValue } from '../core/items';
import type { Outcome, PartySlot, ResolvedHero, RosterUnit } from '../core/types';
import {
  freshSave,
  loadSave,
  writeSaveNow,
  writeSaveThrottled,
  clearSave,
  type Save,
} from './persistence';
import { grantXpToParty } from '../systems/progression';
import { deriveUnitStats } from '../systems/stats';
import { resolveSkills } from '../systems/skills';
import { SKILLS, availablePoints } from '../content/skills';
import { applyFragments } from '../systems/recruit';
import { rollDrop } from '../systems/loot';
import { computeOfflineProgress, estimateFarmRates, type OfflineProgress } from '../systems/afk';
import { xpGainScale } from '../core/formulas';
import { mulberry32, hashSeed } from '../core/rng';
import { MAX_PARTY } from '../content/classes';
import { getLocale, setLocale as setI18nLocale, type Locale } from '../../i18n';

/** Resolve the active party to the shape the simulation & afk maths expect. */
export function resolveParty(roster: RosterUnit[], party: PartySlot[]): ResolvedHero[] {
  const out: ResolvedHero[] = [];
  for (const slot of party) {
    const unit = roster.find((r) => r.classId === slot.classId);
    if (!unit) continue;
    out.push({
      classId: unit.classId,
      line: slot.line,
      partyIndex: out.length,
      level: unit.level,
      stats: deriveUnitStats(unit),
      skills: resolveSkills(unit),
    });
  }
  return out;
}

const activeClassIds = (party: PartySlot[]) => party.map((s) => s.classId);

interface GameState {
  // --- persisted ---------------------------------------------------------
  seed: number;
  locale: Locale;
  gold: number;
  farmingStage: number;
  maxStageCleared: number;
  stageAttempt: number;
  roster: RosterUnit[];
  party: PartySlot[];
  inventory: Item[];
  fragments: Record<string, number>;
  totalKills: number;
  lastActiveAt: number;

  // --- session only ----------------------------------------------------
  ready: boolean;
  offlineSummary: OfflineProgress | null;
  lastOutcome: Outcome | null;
  /** roster indices that just levelled up (for a brief UI flash). */
  recentLevelUps: number[];
  /** classIds unlocked recently (for a toast). */
  recentRecruits: string[];
  /** bump this to force the battle to rebuild (party/gear changed). */
  loadoutRev: number;
  /** monotonic counter to keep generated item ids unique. */
  lootCounter: number;

  // --- actions --------------------------------------------------------
  init: () => void;
  setLocale: (locale: Locale) => void;
  addKillRewards: (gold: number, xp: number, kills: number) => void;
  addFragments: (n: number) => void;
  reportBattleEnd: (outcome: Outcome) => void;
  fieldHero: (classId: string) => void;
  benchHero: (classId: string) => void;
  setLine: (classId: string, line: 'front' | 'back') => void;
  equipItem: (classId: string, itemId: string) => void;
  unequipItem: (classId: string, slot: Item['slot']) => void;
  sellItem: (itemId: string) => void;
  sellItems: (pred: (i: Item) => boolean) => void;
  spendSkillPoint: (classId: string, skillId: string) => void;
  respecSkills: (classId: string) => void;
  dismissOfflineSummary: () => void;
  dismissRecruits: () => void;
  touchActive: () => void;
  resetGame: () => void;
  snapshotSave: () => Save;
}

/** The stage whose farm rate drives offline gains (highest cleared, min 1). */
const idleStage = (maxStageCleared: number) => Math.max(1, maxStageCleared);

let levelFlashTimer: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  seed: 0,
  locale: 'es',
  gold: 0,
  farmingStage: 1,
  maxStageCleared: 0,
  stageAttempt: 1,
  roster: [],
  party: [],
  inventory: [],
  fragments: {},
  totalKills: 0,
  lastActiveAt: Date.now(),

  ready: false,
  offlineSummary: null,
  lastOutcome: null,
  recentLevelUps: [],
  recentRecruits: [],
  loadoutRev: 0,
  lootCounter: 0,

  init: () => {
    const save = loadSave();
    const now = Date.now();

    const rates = estimateFarmRates({
      seed: save.seed,
      stage: idleStage(save.maxStageCleared),
      party: resolveParty(save.roster, save.party),
    });
    const offline = computeOfflineProgress({ lastActiveAt: save.lastActiveAt, now, rates });

    // Offline XP goes to the fielded party only; apply straight away.
    const offStage = idleStage(save.maxStageCleared);
    const { roster } = grantXpToParty(
      save.roster,
      activeClassIds(save.party),
      offline.xp,
      (u) => xpGainScale(u.level, offStage),
    );

    setI18nLocale(save.locale);

    set({
      seed: save.seed,
      locale: save.locale,
      gold: save.gold + offline.gold,
      farmingStage: save.farmingStage,
      maxStageCleared: save.maxStageCleared,
      stageAttempt: save.stageAttempt,
      roster,
      party: save.party,
      inventory: save.inventory,
      fragments: save.fragments,
      totalKills: save.totalKills,
      lastActiveAt: now,
      ready: true,
      offlineSummary:
        offline.seconds > 60 && (offline.gold > 0 || offline.xp > 0) ? offline : null,
    });

    writeSaveNow(get().snapshotSave());
  },

  setLocale: (locale) => {
    setI18nLocale(locale);
    set({ locale });
    writeSaveThrottled(get().snapshotSave());
  },

  addKillRewards: (gold, xp, kills) => {
    if (gold <= 0 && xp <= 0 && kills <= 0) return;
    const s = get();
    const patch: Partial<GameState> = {
      gold: s.gold + Math.max(0, gold),
      totalKills: s.totalKills + Math.max(0, kills),
      lastActiveAt: Date.now(),
    };
    if (xp > 0) {
      const { roster, leveledUp } = grantXpToParty(
        s.roster,
        activeClassIds(s.party),
        xp,
        (u) => xpGainScale(u.level, s.farmingStage),
      );
      patch.roster = roster;
      if (leveledUp.length > 0) {
        patch.recentLevelUps = leveledUp;
        if (levelFlashTimer) clearTimeout(levelFlashTimer);
        levelFlashTimer = setTimeout(() => set({ recentLevelUps: [] }), 1500);
      }
    }
    set(patch);
    writeSaveThrottled(get().snapshotSave());
  },

  addFragments: (n) => {
    if (n <= 0) return;
    const s = get();
    const res = applyFragments(s.roster, s.party, s.fragments, n);
    set({
      roster: res.roster,
      party: res.party,
      fragments: res.fragments,
      recentRecruits: res.recruited.length > 0 ? res.recruited : s.recentRecruits,
      loadoutRev: res.recruited.length > 0 ? s.loadoutRev + 1 : s.loadoutRev,
    });
    if (res.recruited.length > 0) writeSaveNow(get().snapshotSave());
    else writeSaveThrottled(get().snapshotSave());
  },

  reportBattleEnd: (outcome) => {
    const s = get();
    if (outcome === 'victory') {
      const LOOT_SALT = 0x1007;
      const rng = mulberry32(hashSeed(s.seed, s.farmingStage, s.stageAttempt, LOOT_SALT, s.lootCounter));
      const drop = rollDrop({ stage: s.farmingStage, rng, idSeed: s.lootCounter });
      set({
        maxStageCleared: Math.max(s.maxStageCleared, s.farmingStage),
        farmingStage: s.farmingStage + 1,
        stageAttempt: 1,
        lastOutcome: 'victory',
        inventory: drop ? [...s.inventory, drop] : s.inventory,
        lootCounter: s.lootCounter + 1,
      });
    } else if (outcome === 'defeat') {
      set({ stageAttempt: s.stageAttempt + 1, lastOutcome: 'defeat' });
    }
    writeSaveThrottled(get().snapshotSave());
  },

  fieldHero: (classId) => {
    const s = get();
    if (s.party.some((p) => p.classId === classId)) return;
    if (s.party.length >= MAX_PARTY) return;
    if (!s.roster.some((r) => r.classId === classId)) return;
    set({
      party: [...s.party, { classId, line: 'back' }],
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveThrottled(get().snapshotSave());
  },

  benchHero: (classId) => {
    const s = get();
    if (s.party.length <= 1) return; // keep at least one fighter
    set({
      party: s.party.filter((p) => p.classId !== classId),
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveThrottled(get().snapshotSave());
  },

  setLine: (classId, line) => {
    const s = get();
    set({
      party: s.party.map((p) => (p.classId === classId ? { ...p, line } : p)),
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveThrottled(get().snapshotSave());
  },

  equipItem: (classId, itemId) => {
    const s = get();
    const item = s.inventory.find((i) => i.id === itemId);
    const heroIdx = s.roster.findIndex((r) => r.classId === classId);
    if (!item || heroIdx < 0) return;

    const hero = s.roster[heroIdx];
    const prev = hero.equipment[item.slot];
    const roster = s.roster.map((r, i) =>
      i === heroIdx ? { ...r, equipment: { ...r.equipment, [item.slot]: item } } : r,
    );
    const inventory = s.inventory.filter((i) => i.id !== itemId);
    if (prev) inventory.push(prev);

    set({ roster, inventory, loadoutRev: s.loadoutRev + 1 });
    writeSaveThrottled(get().snapshotSave());
  },

  unequipItem: (classId, slot) => {
    const s = get();
    const heroIdx = s.roster.findIndex((r) => r.classId === classId);
    if (heroIdx < 0) return;
    const item = s.roster[heroIdx].equipment[slot];
    if (!item) return;
    set({
      roster: s.roster.map((r, i) =>
        i === heroIdx ? { ...r, equipment: { ...r.equipment, [slot]: null } } : r,
      ),
      inventory: [...s.inventory, item],
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveThrottled(get().snapshotSave());
  },

  sellItem: (itemId) => {
    const s = get();
    const item = s.inventory.find((i) => i.id === itemId);
    if (!item) return;
    set({
      inventory: s.inventory.filter((i) => i.id !== itemId),
      gold: s.gold + itemValue(item),
    });
    writeSaveThrottled(get().snapshotSave());
  },

  sellItems: (pred) => {
    const s = get();
    let gained = 0;
    const keep: Item[] = [];
    for (const i of s.inventory) {
      if (pred(i)) gained += itemValue(i);
      else keep.push(i);
    }
    if (gained === 0) return;
    set({ inventory: keep, gold: s.gold + gained });
    writeSaveThrottled(get().snapshotSave());
  },

  spendSkillPoint: (classId, skillId) => {
    const s = get();
    const idx = s.roster.findIndex((r) => r.classId === classId);
    const def = SKILLS[skillId];
    if (idx < 0 || !def || def.classId !== classId) return;

    const hero = s.roster[idx];
    const rank = hero.skills[skillId] ?? 0;
    if (rank >= def.maxRank) return;
    if (hero.level < def.unlockLevel) return;
    if (def.requires && (hero.skills[def.requires] ?? 0) < 1) return;
    if (availablePoints(hero) < def.costPerRank) return;

    const roster = s.roster.map((r, i) =>
      i === idx ? { ...r, skills: { ...r.skills, [skillId]: rank + 1 } } : r,
    );
    set({ roster, loadoutRev: s.loadoutRev + 1 });
    writeSaveThrottled(get().snapshotSave());
  },

  respecSkills: (classId) => {
    const s = get();
    const idx = s.roster.findIndex((r) => r.classId === classId);
    if (idx < 0 || Object.keys(s.roster[idx].skills).length === 0) return;
    set({
      roster: s.roster.map((r, i) => (i === idx ? { ...r, skills: {} } : r)),
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveNow(get().snapshotSave());
  },

  dismissOfflineSummary: () => set({ offlineSummary: null }),
  dismissRecruits: () => set({ recentRecruits: [] }),

  touchActive: () => {
    set({ lastActiveAt: Date.now() });
    writeSaveThrottled(get().snapshotSave());
  },

  resetGame: () => {
    clearSave();
    const fresh = freshSave();
    setI18nLocale(fresh.locale);
    set({
      seed: fresh.seed,
      locale: fresh.locale,
      gold: fresh.gold,
      farmingStage: fresh.farmingStage,
      maxStageCleared: fresh.maxStageCleared,
      stageAttempt: fresh.stageAttempt,
      roster: fresh.roster,
      party: fresh.party,
      inventory: fresh.inventory,
      fragments: fresh.fragments,
      totalKills: fresh.totalKills,
      lastActiveAt: fresh.lastActiveAt,
      offlineSummary: null,
      lastOutcome: null,
      recentLevelUps: [],
      recentRecruits: [],
      loadoutRev: get().loadoutRev + 1,
    });
    writeSaveNow(get().snapshotSave());
  },

  snapshotSave: () => {
    const s = get();
    return {
      version: 3,
      seed: s.seed,
      locale: s.locale,
      gold: Math.floor(s.gold),
      farmingStage: s.farmingStage,
      maxStageCleared: s.maxStageCleared,
      stageAttempt: s.stageAttempt,
      roster: s.roster,
      party: s.party,
      inventory: s.inventory,
      fragments: s.fragments,
      totalKills: s.totalKills,
      lastActiveAt: s.lastActiveAt,
    };
  },
}));

/** Keep the store's locale in sync if it is changed elsewhere (defensive). */
export function syncLocaleFromI18n(): void {
  const l = getLocale();
  if (useGameStore.getState().locale !== l) useGameStore.setState({ locale: l });
}
