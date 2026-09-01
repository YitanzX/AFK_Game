/**
 * Turns a persistent RosterUnit into the final combat Stats block: class base
 * stats for its level, plus every equipped item's affixes.
 *
 * Order matters: all flat affixes are summed onto the base first, then percent
 * affixes are applied to that subtotal. So "+10 atk" and "+20% atk" on a 100 atk
 * base give (100 + 10) * 1.2 = 132, not 100*1.2 + 10.
 */

import type { AffixStat, Item } from '../core/items';
import type { RosterUnit, Stats } from '../core/types';
import { statsForLevel } from '../content/classes';

const CRIT_CHANCE_CAP = 0.75;
const ATTACK_SPEED_CAP = 3;

const PERCENTABLE: AffixStat[] = ['atk', 'maxHp', 'def', 'critChance', 'attackSpeed'];

export function deriveUnitStats(unit: RosterUnit): Stats {
  const s: Stats = { ...statsForLevel(unit.classId, unit.level) };

  const pct: Record<AffixStat, number> = {
    atk: 0,
    maxHp: 0,
    def: 0,
    critChance: 0,
    attackSpeed: 0,
  };

  for (const item of equippedItems(unit)) {
    for (const affix of item.affixes) {
      if (affix.isPercent) pct[affix.stat] += affix.value;
      else s[affix.stat] += affix.value;
    }
  }

  for (const stat of PERCENTABLE) {
    if (pct[stat]) s[stat] *= 1 + pct[stat] / 100;
  }

  // Rounding + sanity caps.
  s.maxHp = Math.round(s.maxHp);
  s.atk = Math.round(s.atk);
  s.def = Math.round(s.def);
  s.critChance = Math.min(CRIT_CHANCE_CAP, round3(s.critChance));
  s.attackSpeed = Math.min(ATTACK_SPEED_CAP, round3(s.attackSpeed));
  return s;
}

export function equippedItems(unit: RosterUnit): Item[] {
  const { weapon, armor, accessory } = unit.equipment;
  return [weapon, armor, accessory].filter((i): i is Item => i != null);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
