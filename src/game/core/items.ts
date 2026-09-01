/**
 * Equipment item model. Items are plain data; their display name and colour are
 * derived from `slot` + `rarity` in the UI (i18n), not stored.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';
export type ItemSlot = 'weapon' | 'armor' | 'accessory';

/** Stats an affix can modify (subset of the combat Stats block). */
export type AffixStat = 'atk' | 'maxHp' | 'def' | 'critChance' | 'attackSpeed';

export interface Affix {
  stat: AffixStat;
  /** Flat amount, or percent points when `isPercent`. */
  value: number;
  isPercent: boolean;
}

export interface Item {
  id: string;
  slot: ItemSlot;
  rarity: Rarity;
  /** Item level ~ the stage it dropped at; drives affix magnitude. */
  ilvl: number;
  affixes: Affix[];
}

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic'];
export const ITEM_SLOTS: ItemSlot[] = ['weapon', 'armor', 'accessory'];

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
};

export function rarityRank(r: Rarity): number {
  return RARITY_RANK[r];
}

/** Gold you get for selling an item. */
export function itemValue(item: Item): number {
  const base = 8 + item.ilvl * 4;
  const rarityMult = 1 + rarityRank(item.rarity) * 1.4;
  return Math.round(base * rarityMult + item.affixes.length * 5);
}

/** Rough "power" of an item for sorting a comparison list. */
export function itemScore(item: Item): number {
  return rarityRank(item.rarity) * 1000 + item.ilvl * 10 + item.affixes.length;
}
