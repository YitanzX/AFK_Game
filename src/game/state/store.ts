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
import { emptyEquipment } from '../core/types';
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
import { computeMetaBonuses, type MetaBonuses } from '../systems/meta';
import { META_NODE_BY_ID, nodeCost, nodeSpent } from '../content/metaTree';
import { RELIC_BY_ID, relicGain, prestigeRunStart } from '../content/prestige';
import { xpGainScale } from '../core/formulas';
import { mulberry32, hashSeed } from '../core/rng';
import { getLocale, setLocale as setI18nLocale, type Locale } from '../../i18n';

/** Resolve the active party to the shape the simulation & afk maths expect. */
export function resolveParty(
  roster: RosterUnit[],
  party: PartySlot[],
  meta?: MetaBonuses,
): ResolvedHero[] {
  const out: ResolvedHero[] = [];
  for (const slot of party) {
    const unit = roster.find((r) => r.classId === slot.classId);
    if (!unit) continue;
    const stats = deriveUnitStats(unit);
    if (meta) {
      stats.atk = Math.round(stats.atk * meta.atkMult);
      stats.maxHp = Math.round(stats.maxHp * meta.hpMult);
      stats.def = Math.round(stats.def * meta.defMult);
      stats.attackSpeed = Math.min(3, stats.attackSpeed * meta.atkSpeedMult);
      stats.critChance = Math.min(0.75, stats.critChance + meta.critAdd);
      stats.critDmg += meta.critDmgAdd;
    }
    out.push({
      classId: unit.classId,
      line: slot.line,
      partyIndex: out.length,
      level: unit.level,
      stats,
      skills: resolveSkills(unit),
      lifesteal: meta?.lifestealPct ?? 0,
      skillCdMult: meta?.skillCdMult ?? 1,
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
  metaTree: Record<string, number>;
  relics: number;
  prestigeUpgrades: Record<string, number>;
  prestigeCount: number;
  bestStageEver: number;
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
  buyMetaNode: (nodeId: string) => void;
  respecMetaTree: () => void;
  buyRelicUpgrade: (id: string) => void;
  prestige: () => void;
  meta: () => MetaBonuses;
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
  metaTree: {},
  relics: 0,
  prestigeUpgrades: {},
  prestigeCount: 0,
  bestStageEver: 0,
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
    const meta = computeMetaBonuses(save);

    const rates = estimateFarmRates({
      seed: save.seed,
      stage: idleStage(save.maxStageCleared),
      party: resolveParty(save.roster, save.party, meta),
    });
    const offline = computeOfflineProgress({
      lastActiveAt: save.lastActiveAt,
      now,
      rates,
      multipliers: { gold: meta.goldMult, xp: meta.xpMult },
      capSeconds: meta.afkCapHours * 3600,
    });

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
      metaTree: save.metaTree,
      relics: save.relics,
      prestigeUpgrades: save.prestigeUpgrades,
      prestigeCount: save.prestigeCount,
      bestStageEver: save.bestStageEver,
      lastActiveAt: now,
      ready: true,
      offlineSummary:
        offline.seconds > 60 && (offline.gold > 0 || offline.xp > 0) ? offline : null,
    });

    writeSaveNow(get().snapshotSave());
  },

  meta: () => {
    const s = get();
    return computeMetaBonuses({
      metaTree: s.metaTree,
      prestigeUpgrades: s.prestigeUpgrades,
      relics: s.relics,
    });
  },

  setLocale: (locale) => {
    setI18nLocale(locale);
    set({ locale });
    writeSaveThrottled(get().snapshotSave());
  },

  addKillRewards: (gold, xp, kills) => {
    if (gold <= 0 && xp <= 0 && kills <= 0) return;
    const s = get();
    const m = get().meta();
    const patch: Partial<GameState> = {
      gold: s.gold + Math.max(0, gold) * m.goldMult,
      totalKills: s.totalKills + Math.max(0, kills),
      lastActiveAt: Date.now(),
    };
    if (xp > 0) {
      const { roster, leveledUp } = grantXpToParty(
        s.roster,
        activeClassIds(s.party),
        xp * m.xpMult,
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
    const res = applyFragments(s.roster, s.party, s.fragments, n * get().meta().fragmentMult);
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
      const drop = rollDrop({
        stage: s.farmingStage,
        rng,
        idSeed: s.lootCounter,
        luck: get().meta().dropMult,
      });
      set({
        maxStageCleared: Math.max(s.maxStageCleared, s.farmingStage),
        bestStageEver: Math.max(s.bestStageEver, s.farmingStage),
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
    if (s.party.length >= get().meta().partySlots) return;
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

  buyMetaNode: (nodeId) => {
    const s = get();
    const node = META_NODE_BY_ID[nodeId];
    if (!node) return;
    const rank = s.metaTree[nodeId] ?? 0;
    if (rank >= node.maxRank) return;
    if (node.requires && (s.metaTree[node.requires] ?? 0) < 1) return;
    const cost = nodeCost(node, rank);
    if (s.gold < cost) return;
    set({
      gold: s.gold - cost,
      metaTree: { ...s.metaTree, [nodeId]: rank + 1 },
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveNow(get().snapshotSave());
  },

  respecMetaTree: () => {
    const s = get();
    let refund = 0;
    for (const [id, rank] of Object.entries(s.metaTree)) {
      const node = META_NODE_BY_ID[id];
      if (node) refund += nodeSpent(node, rank);
    }
    if (refund === 0) return;
    set({ gold: s.gold + refund, metaTree: {}, loadoutRev: s.loadoutRev + 1 });
    writeSaveNow(get().snapshotSave());
  },

  buyRelicUpgrade: (id) => {
    const s = get();
    const up = RELIC_BY_ID[id];
    if (!up) return;
    const rank = s.prestigeUpgrades[id] ?? 0;
    if (rank >= up.maxRank || s.relics < up.costPerRank) return;
    set({
      relics: s.relics - up.costPerRank,
      prestigeUpgrades: { ...s.prestigeUpgrades, [id]: rank + 1 },
      loadoutRev: s.loadoutRev + 1,
    });
    writeSaveNow(get().snapshotSave());
  },

  prestige: () => {
    const s = get();
    const best = Math.max(s.bestStageEver, s.maxStageCleared);
    const gain = relicGain(best);
    if (gain <= 0) return;

    const start = prestigeRunStart(s.prestigeUpgrades);
    const roster = s.roster.map((r) => ({
      ...r,
      level: start.level,
      xp: 0,
      skills: {},
      equipment: start.keepGear ? r.equipment : emptyEquipment(),
    }));

    set({
      relics: s.relics + gain,
      prestigeCount: s.prestigeCount + 1,
      bestStageEver: best,
      roster,
      inventory: [],
      gold: 0,
      fragments: {},
      farmingStage: start.stage,
      maxStageCleared: Math.max(0, start.stage - 1),
      stageAttempt: 1,
      lootCounter: s.lootCounter + 1,
      loadoutRev: s.loadoutRev + 1,
      lastOutcome: null,
      recentLevelUps: [],
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
      metaTree: fresh.metaTree,
      relics: fresh.relics,
      prestigeUpgrades: fresh.prestigeUpgrades,
      prestigeCount: fresh.prestigeCount,
      bestStageEver: fresh.bestStageEver,
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
      version: 4,
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
      metaTree: s.metaTree,
      relics: s.relics,
      prestigeUpgrades: s.prestigeUpgrades,
      prestigeCount: s.prestigeCount,
      bestStageEver: s.bestStageEver,
      lastActiveAt: s.lastActiveAt,
    };
  },
}));

/** Keep the store's locale in sync if it is changed elsewhere (defensive). */
export function syncLocaleFromI18n(): void {
  const l = getLocale();
  if (useGameStore.getState().locale !== l) useGameStore.setState({ locale: l });
}
