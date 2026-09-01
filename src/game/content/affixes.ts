/**
 * Affix pools and magnitude curves for generated equipment.
 *
 * Each slot has a weighted pool of possible affix stats. An affix's value scales
 * with item level and a per-rarity multiplier; flat and percent affixes use
 * different base curves.
 */

import type { AffixStat, ItemSlot, Rarity } from '../core/items';

export interface RarityConfig {
  /** How many affixes an item of this rarity rolls. */
  affixCount: number;
  /** Magnitude multiplier applied to every affix value. */
  magnitude: number;
}

export const RARITY_CONFIG: Record<Rarity, RarityConfig> = {
  common: { affixCount: 1, magnitude: 1 },
  uncommon: { affixCount: 2, magnitude: 1.35 },
  rare: { affixCount: 3, magnitude: 1.8 },
  epic: { affixCount: 3, magnitude: 2.5 },
};

interface AffixSpec {
  stat: AffixStat;
  isPercent: boolean;
  weight: number;
  /** Value at ilvl 1 before the rarity multiplier. */
  base: number;
  /** Added to `base` per item level above 1. */
  perIlvl: number;
}

/** Weighted affix specs per slot. */
export const AFFIX_POOLS: Record<ItemSlot, AffixSpec[]> = {
  weapon: [
    { stat: 'atk', isPercent: false, weight: 5, base: 6, perIlvl: 2.4 },
    { stat: 'atk', isPercent: true, weight: 3, base: 4, perIlvl: 0.35 },
    { stat: 'critChance', isPercent: false, weight: 2, base: 0.02, perIlvl: 0.0025 },
    { stat: 'attackSpeed', isPercent: true, weight: 2, base: 3, perIlvl: 0.15 },
  ],
  armor: [
    { stat: 'maxHp', isPercent: false, weight: 5, base: 24, perIlvl: 11 },
    { stat: 'maxHp', isPercent: true, weight: 3, base: 4, perIlvl: 0.3 },
    { stat: 'def', isPercent: false, weight: 4, base: 3, perIlvl: 1.4 },
    { stat: 'def', isPercent: true, weight: 2, base: 5, perIlvl: 0.3 },
  ],
  accessory: [
    { stat: 'atk', isPercent: false, weight: 2, base: 4, perIlvl: 1.6 },
    { stat: 'maxHp', isPercent: false, weight: 2, base: 18, perIlvl: 8 },
    { stat: 'def', isPercent: false, weight: 2, base: 2, perIlvl: 1 },
    { stat: 'critChance', isPercent: false, weight: 2, base: 0.02, perIlvl: 0.002 },
    { stat: 'attackSpeed', isPercent: true, weight: 2, base: 3, perIlvl: 0.12 },
  ],
};

/** Roll a single affix value for the given ilvl + rarity magnitude. */
export function affixValue(spec: AffixSpec, ilvl: number, magnitude: number): number {
  const raw = (spec.base + spec.perIlvl * Math.max(0, ilvl - 1)) * magnitude;
  if (spec.isPercent) return Math.round(raw * 10) / 10;
  if (spec.stat === 'critChance') return Math.round(raw * 1000) / 1000;
  if (spec.stat === 'attackSpeed') return Math.round(raw * 10) / 10;
  return Math.round(raw);
}

export type { AffixSpec };
