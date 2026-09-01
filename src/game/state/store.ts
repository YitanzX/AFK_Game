/**
 * Central game store (Zustand). Holds the persisted save fields plus a little
 * session-only UI state, and exposes the actions that mutate them.
 *
 * The live combat simulation does NOT live here (it would cause 20 re-renders a
 * second) - see battleController.ts. The store is only touched when the battle
 * awards kill rewards or a stage is cleared/failed.
 */

import { create } from 'zustand';
import type { Outcome, RosterUnit } from '../core/types';
import {
  freshSave,
  loadSave,
  writeSaveNow,
  writeSaveThrottled,
  clearSave,
  type SaveV1,
} from './persistence';
import { grantXpToRoster } from '../systems/progression';
import { computeOfflineProgress, estimateFarmRates, type OfflineProgress } from '../systems/afk';
import { getLocale, setLocale as setI18nLocale, type Locale } from '../../i18n';

interface GameState {
  // --- persisted ---------------------------------------------------------
  seed: number;
  locale: Locale;
  gold: number;
  farmingStage: number;
  maxStageCleared: number;
  stageAttempt: number;
  roster: RosterUnit[];
  totalKills: number;
  lastActiveAt: number;

  // --- session only ----------------------------------------------------
  ready: boolean;
  offlineSummary: OfflineProgress | null;
  lastOutcome: Outcome | null;
  /** roster indices that just levelled up (for a brief UI flash). */
  recentLevelUps: number[];

  // --- actions --------------------------------------------------------
  init: () => void;
  setLocale: (locale: Locale) => void;
  /** Called by the battle controller as enemies die. Deltas are whole numbers. */
  addKillRewards: (gold: number, xp: number, kills: number) => void;
  reportBattleEnd: (outcome: Outcome) => void;
  dismissOfflineSummary: () => void;
  touchActive: () => void;
  resetGame: () => void;
  snapshotSave: () => SaveV1;
}

/** The stage whose farm rate drives offline gains (highest cleared, min 1). */
function idleStage(maxStageCleared: number): number {
  return Math.max(1, maxStageCleared);
}

let levelFlashTimer: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = create<GameState>((set, get) => ({
  seed: 0,
  locale: 'es',
  gold: 0,
  farmingStage: 1,
  maxStageCleared: 0,
  stageAttempt: 1,
  roster: [],
  totalKills: 0,
  lastActiveAt: Date.now(),

  ready: false,
  offlineSummary: null,
  lastOutcome: null,
  recentLevelUps: [],

  init: () => {
    const save = loadSave();
    const now = Date.now();

    const rates = estimateFarmRates({
      seed: save.seed,
      stage: idleStage(save.maxStageCleared),
      roster: save.roster,
    });
    const offline = computeOfflineProgress({
      lastActiveAt: save.lastActiveAt,
      now,
      rates,
    });

    // Apply offline gains straight away; the modal is just a summary.
    const { roster } = grantXpToRoster(save.roster, offline.xp);

    setI18nLocale(save.locale);

    set({
      seed: save.seed,
      locale: save.locale,
      gold: save.gold + offline.gold,
      farmingStage: save.farmingStage,
      maxStageCleared: save.maxStageCleared,
      stageAttempt: save.stageAttempt,
      roster,
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
      const { roster, leveledUp } = grantXpToRoster(s.roster, xp);
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

  reportBattleEnd: (outcome) => {
    const s = get();
    if (outcome === 'victory') {
      set({
        maxStageCleared: Math.max(s.maxStageCleared, s.farmingStage),
        farmingStage: s.farmingStage + 1,
        stageAttempt: 1,
        lastOutcome: 'victory',
      });
    } else if (outcome === 'defeat') {
      set({ stageAttempt: s.stageAttempt + 1, lastOutcome: 'defeat' });
    }
    writeSaveThrottled(get().snapshotSave());
  },

  dismissOfflineSummary: () => set({ offlineSummary: null }),

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
      totalKills: fresh.totalKills,
      lastActiveAt: fresh.lastActiveAt,
      offlineSummary: null,
      lastOutcome: null,
      recentLevelUps: [],
    });
    writeSaveNow(get().snapshotSave());
  },

  snapshotSave: () => {
    const s = get();
    return {
      version: 1,
      seed: s.seed,
      locale: s.locale,
      gold: Math.floor(s.gold),
      farmingStage: s.farmingStage,
      maxStageCleared: s.maxStageCleared,
      stageAttempt: s.stageAttempt,
      roster: s.roster,
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
