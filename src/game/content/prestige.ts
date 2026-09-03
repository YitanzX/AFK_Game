/**
 * Prestige: reset the current "life" (levels, stage, gold, gear, skills) in
 * exchange for Relics — a permanent currency spent on the upgrades below.
 * Recruited heroes, party composition and the meta tree are kept.
 */

import type { MetaEffect } from './metaTree';

export interface RelicUpgrade {
  id: string;
  nameKey: string;
  descKey: string;
  maxRank: number;
  costPerRank: number;
  /** Folded into MetaBonuses by `computeMetaBonuses`. */
  metaEffects?: MetaEffect[];
  /** Handled directly by the `prestige()` action instead. */
  runEffect?: 'startStage' | 'startLevel' | 'keepGear';
}

export const RELIC_UPGRADES: RelicUpgrade[] = [
  {
    id: 'relic_xp', nameKey: 'relic.relic_xp', descKey: 'relicdesc.relic_xp',
    maxRank: 10, costPerRank: 2, metaEffects: [{ kind: 'xpMult', perRank: 0.05 }],
  },
  {
    id: 'relic_gold', nameKey: 'relic.relic_gold', descKey: 'relicdesc.relic_gold',
    maxRank: 10, costPerRank: 2, metaEffects: [{ kind: 'goldMult', perRank: 0.05 }],
  },
  {
    id: 'relic_power', nameKey: 'relic.relic_power', descKey: 'relicdesc.relic_power',
    maxRank: 10, costPerRank: 3,
    metaEffects: [
      { kind: 'atkMult', perRank: 0.04 },
      { kind: 'hpMult', perRank: 0.04 },
    ],
  },
  {
    id: 'relic_start', nameKey: 'relic.relic_start', descKey: 'relicdesc.relic_start',
    maxRank: 10, costPerRank: 4, runEffect: 'startStage',
  },
  {
    id: 'relic_headstart', nameKey: 'relic.relic_headstart', descKey: 'relicdesc.relic_headstart',
    maxRank: 10, costPerRank: 4, runEffect: 'startLevel',
  },
  {
    id: 'relic_keepgear', nameKey: 'relic.relic_keepgear', descKey: 'relicdesc.relic_keepgear',
    maxRank: 1, costPerRank: 15, runEffect: 'keepGear',
  },
];

export const RELIC_BY_ID: Record<string, RelicUpgrade> = Object.fromEntries(
  RELIC_UPGRADES.map((u) => [u.id, u]),
);

/** Relics granted for prestiging, from the best stage ever reached. */
export function relicGain(bestStage: number): number {
  return Math.floor(Math.pow(Math.max(0, bestStage) / 8, 1.35));
}

export function relicUpgradeVars(u: RelicUpgrade, rank: number): Record<string, string | number> {
  const r = Math.max(1, rank);
  if (u.runEffect === 'startStage') return { v: 1 + 5 * r };
  if (u.runEffect === 'startLevel') return { v: 1 + 3 * r };
  if (u.runEffect === 'keepGear') return { v: 1 };
  const e = u.metaEffects?.[0];
  return { v: e ? Math.round(e.perRank * r * 1000) / 10 : 0 };
}

/** Where a fresh prestige run starts, from the player's relic upgrades. */
export function prestigeRunStart(prestigeUpgrades: Record<string, number>): {
  stage: number;
  level: number;
  keepGear: boolean;
} {
  const startRank = prestigeUpgrades.relic_start ?? 0;
  const levelRank = prestigeUpgrades.relic_headstart ?? 0;
  return {
    stage: 1 + 5 * startRank,
    level: 1 + 3 * levelRank,
    keepGear: (prestigeUpgrades.relic_keepgear ?? 0) >= 1,
  };
}
