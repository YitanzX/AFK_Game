/**
 * Loot generation. On clearing a stage the game rolls for an item drop; boss
 * stages always drop and skew rarer. Everything goes through the supplied Rng so
 * a given (seed, stage, attempt) yields the same item - testable and replayable.
 */

import type { Item, ItemSlot, Rarity } from '../core/items';
import { ITEM_SLOTS, RARITIES } from '../core/items';
import type { Rng } from '../core/rng';
import { AFFIX_POOLS, RARITY_CONFIG, affixValue, type AffixSpec } from '../content/affixes';
import { isBossStage } from '../content/stages';

/** Chance a normal stage clear drops an item. */
const NORMAL_DROP_CHANCE = 0.38;

/** Rarity weights shift toward the rare end as stages climb (and with `luck`). */
function rarityWeights(stage: number, bossBonus: boolean, luck: number): number[] {
  const t = Math.min(1, stage / 40);
  const l = Math.max(1, luck);
  const w = [
    Math.max(0.05, 1 - t * 0.8), // common
    0.5 + t * 0.2, // uncommon
    (0.12 + t * 0.5) * l, // rare
    (0.02 + t * 0.4) * l * l, // epic
  ];
  if (bossBonus) {
    w[0] *= 0.3;
    w[2] *= 1.8;
    w[3] *= 2.5;
  }
  return w;
}

function weightedPick<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function rollAffixes(slot: ItemSlot, rarity: Rarity, ilvl: number, rng: Rng) {
  const pool = AFFIX_POOLS[slot];
  const { affixCount, magnitude } = RARITY_CONFIG[rarity];
  const picked: AffixSpec[] = [];
  const available = [...pool];

  for (let i = 0; i < affixCount && available.length > 0; i++) {
    const spec = weightedPick(
      rng,
      available,
      available.map((a) => a.weight),
    );
    available.splice(available.indexOf(spec), 1);
    picked.push(spec);
  }

  return picked.map((spec) => ({
    stat: spec.stat,
    isPercent: spec.isPercent,
    value: affixValue(spec, ilvl, magnitude),
  }));
}

export interface DropContext {
  stage: number;
  rng: Rng;
  /** Monotonic-ish suffix for the item id (e.g. a run counter). */
  idSeed: number;
  /** >= 1: meta-tree drop bonus (chance + rarity). Default 1. */
  luck?: number;
}

/** Roll a stage-clear drop. Returns null when nothing drops. */
export function rollDrop(ctx: DropContext): Item | null {
  const boss = isBossStage(ctx.stage);
  const luck = Math.max(1, ctx.luck ?? 1);
  if (!boss && !ctx.rng.chance(Math.min(0.95, NORMAL_DROP_CHANCE * luck))) return null;

  const slot = ctx.rng.pick(ITEM_SLOTS);
  const rarity = weightedPick(ctx.rng, RARITIES, rarityWeights(ctx.stage, boss, luck));
  const ilvl = Math.max(1, ctx.stage);

  return {
    id: `it_${ctx.stage}_${ctx.idSeed}_${Math.floor(ctx.rng.next() * 1e9).toString(36)}`,
    slot,
    rarity,
    ilvl,
    affixes: rollAffixes(slot, rarity, ilvl, ctx.rng),
  };
}
