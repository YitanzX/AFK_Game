import { describe, it, expect } from 'vitest';
import { grantXpToRoster, grantXpToParty, MAX_LEVEL } from '../systems/progression';
import { xpForLevel } from '../core/formulas';
import { hero } from './_fixtures';

const roster = () => [hero('warrior', 1, 0), hero('mage', 3, 10)];

describe('grantXpToRoster', () => {
  it('does not mutate the input', () => {
    const input = roster();
    const snapshot = JSON.stringify(input);
    grantXpToRoster(input, 500);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('rolls a single level when exactly enough xp is granted', () => {
    const { roster: out, leveledUp } = grantXpToRoster([hero('warrior')], xpForLevel(1));
    expect(out[0].level).toBe(2);
    expect(out[0].xp).toBe(0);
    expect(leveledUp).toEqual([0]);
  });

  it('carries the remainder into the next level', () => {
    const { roster: out } = grantXpToRoster([hero('warrior')], xpForLevel(1) + 5);
    expect(out[0].level).toBe(2);
    expect(out[0].xp).toBe(5);
  });

  it('can cross several levels at once', () => {
    const total = xpForLevel(1) + xpForLevel(2) + xpForLevel(3);
    const { roster: out } = grantXpToRoster([hero('mage')], total);
    expect(out[0].level).toBe(4);
    expect(out[0].xp).toBe(0);
  });

  it('clamps at MAX_LEVEL', () => {
    const { roster: out } = grantXpToRoster([hero('mage', MAX_LEVEL - 1)], Number.MAX_SAFE_INTEGER);
    expect(out[0].level).toBe(MAX_LEVEL);
    expect(out[0].xp).toBe(0);
  });

  it('reports only the heroes that levelled', () => {
    const { leveledUp } = grantXpToRoster(roster(), xpForLevel(1));
    expect(leveledUp).toContain(0);
    expect(leveledUp).not.toContain(1);
  });
});

describe('grantXpToParty', () => {
  it('only touches heroes whose classId is fielded', () => {
    const r = [hero('warrior'), hero('mage'), hero('priest')];
    const { roster: out, leveledUp } = grantXpToParty(r, ['warrior', 'priest'], xpForLevel(1));
    expect(out[0].level).toBe(2); // warrior fielded
    expect(out[1].level).toBe(1); // mage benched - untouched
    expect(out[1].xp).toBe(0);
    expect(out[2].level).toBe(2); // priest fielded
    expect(leveledUp).toEqual([0, 2]);
  });

  it('leaves benched heroes as the same object', () => {
    const r = [hero('warrior'), hero('mage')];
    const { roster: out } = grantXpToParty(r, ['warrior'], 999);
    expect(out[1]).toBe(r[1]);
  });
});
