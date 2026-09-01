import { describe, it, expect } from 'vitest';
import { deriveUnitStats } from '../systems/stats';
import { statsForLevel } from '../content/classes';
import type { Item } from '../core/items';
import { hero } from './_fixtures';

function item(partial: Partial<Item> & Pick<Item, 'slot' | 'affixes'>): Item {
  return { id: 'x', rarity: 'common', ilvl: 1, ...partial };
}

describe('deriveUnitStats', () => {
  it('equals class stats when nothing is equipped', () => {
    const u = hero('warrior', 5);
    expect(deriveUnitStats(u)).toEqual(statsForLevel('warrior', 5));
  });

  it('adds flat affixes then applies percent affixes to the subtotal', () => {
    const base = statsForLevel('warrior', 1).atk;
    const u = hero('warrior', 1);
    u.equipment.weapon = item({
      slot: 'weapon',
      affixes: [
        { stat: 'atk', value: 10, isPercent: false },
        { stat: 'atk', value: 50, isPercent: true },
      ],
    });
    // (base + 10) * 1.5
    expect(deriveUnitStats(u).atk).toBe(Math.round((base + 10) * 1.5));
  });

  it('stacks affixes from multiple items', () => {
    const baseHp = statsForLevel('mage', 1).maxHp;
    const u = hero('mage', 1);
    u.equipment.armor = item({ slot: 'armor', affixes: [{ stat: 'maxHp', value: 100, isPercent: false }] });
    u.equipment.accessory = item({
      slot: 'accessory',
      affixes: [{ stat: 'maxHp', value: 50, isPercent: false }],
    });
    expect(deriveUnitStats(u).maxHp).toBe(baseHp + 150);
  });

  it('caps crit chance at 75%', () => {
    const u = hero('rogue', 1);
    u.equipment.weapon = item({
      slot: 'weapon',
      affixes: [{ stat: 'critChance', value: 5, isPercent: false }],
    });
    expect(deriveUnitStats(u).critChance).toBe(0.75);
  });

  it('does not mutate the roster unit', () => {
    const u = hero('warrior', 3);
    u.equipment.weapon = item({ slot: 'weapon', affixes: [{ stat: 'atk', value: 9, isPercent: false }] });
    const snap = JSON.stringify(u);
    deriveUnitStats(u);
    expect(JSON.stringify(u)).toBe(snap);
  });
});
