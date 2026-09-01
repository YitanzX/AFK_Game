import { describe, it, expect } from 'vitest';
import { grantXpToRoster, MAX_LEVEL } from '../systems/progression';
import { xpForLevel } from '../core/formulas';
import type { RosterUnit } from '../core/types';

const roster = (): RosterUnit[] => [
  { classId: 'warrior', level: 1, xp: 0 },
  { classId: 'mage', level: 3, xp: 10 },
];

describe('grantXpToRoster', () => {
  it('does not mutate the input', () => {
    const input = roster();
    const snapshot = JSON.stringify(input);
    grantXpToRoster(input, 500);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('rolls a single level when exactly enough xp is granted', () => {
    const { roster: out, leveledUp } = grantXpToRoster(
      [{ classId: 'warrior', level: 1, xp: 0 }],
      xpForLevel(1),
    );
    expect(out[0].level).toBe(2);
    expect(out[0].xp).toBe(0);
    expect(leveledUp).toEqual([0]);
  });

  it('carries the remainder into the next level', () => {
    const { roster: out } = grantXpToRoster(
      [{ classId: 'warrior', level: 1, xp: 0 }],
      xpForLevel(1) + 5,
    );
    expect(out[0].level).toBe(2);
    expect(out[0].xp).toBe(5);
  });

  it('can cross several levels at once', () => {
    const total = xpForLevel(1) + xpForLevel(2) + xpForLevel(3);
    const { roster: out } = grantXpToRoster([{ classId: 'mage', level: 1, xp: 0 }], total);
    expect(out[0].level).toBe(4);
    expect(out[0].xp).toBe(0);
  });

  it('clamps at MAX_LEVEL', () => {
    const { roster: out } = grantXpToRoster(
      [{ classId: 'mage', level: MAX_LEVEL - 1, xp: 0 }],
      1e12,
    );
    expect(out[0].level).toBe(MAX_LEVEL);
    expect(out[0].xp).toBe(0);
  });

  it('reports only the heroes that levelled', () => {
    const { leveledUp } = grantXpToRoster(roster(), xpForLevel(1));
    expect(leveledUp).toContain(0);
    expect(leveledUp).not.toContain(1);
  });
});
