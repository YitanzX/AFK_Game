import { describe, it, expect } from 'vitest';
import { coerce, freshSave, SAVE_VERSION } from '../state/persistence';

/** A v1 save as written by the pre-M2 build. */
const V1 = {
  version: 1,
  seed: 12345,
  locale: 'en',
  gold: 500,
  farmingStage: 8,
  maxStageCleared: 7,
  stageAttempt: 2,
  roster: [
    { classId: 'warrior', level: 6, xp: 40 },
    { classId: 'mage', level: 6, xp: 40 },
  ],
  totalKills: 321,
  lastActiveAt: 1_700_000_000_000,
};

describe('coerce (save migration)', () => {
  it('upgrades a v1 save to the current version, keeping progress', () => {
    const s = coerce(V1)!;
    expect(s).not.toBeNull();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.gold).toBe(500);
    expect(s.farmingStage).toBe(8);
    expect(s.totalKills).toBe(321);
    expect(s.roster.map((r) => r.classId)).toEqual(['warrior', 'mage']);
  });

  it('gives every migrated hero empty equipment slots', () => {
    const s = coerce(V1)!;
    for (const u of s.roster) {
      expect(u.equipment).toEqual({ weapon: null, armor: null, accessory: null });
    }
  });

  it('synthesises a party and empty inventory/fragments for a v1 save', () => {
    const s = coerce(V1)!;
    expect(s.party.length).toBeGreaterThan(0);
    expect(s.party.every((p) => s.roster.some((r) => r.classId === p.classId))).toBe(true);
    expect(s.inventory).toEqual([]);
    expect(s.fragments).toEqual({});
  });

  it('round-trips a v2 save', () => {
    const fresh = freshSave();
    const again = coerce(JSON.parse(JSON.stringify(fresh)))!;
    expect(again.party).toEqual(fresh.party);
    expect(again.roster.map((r) => r.classId)).toEqual(fresh.roster.map((r) => r.classId));
  });

  it('rejects junk', () => {
    expect(coerce(null)).toBeNull();
    expect(coerce({ version: 99 })).toBeNull();
    expect(coerce({ version: 2, roster: 'nope' })).toBeNull();
    expect(coerce({ version: 2, roster: [] })).toBeNull();
  });

  it('drops party entries for classes not in the roster', () => {
    const s = coerce({
      ...V1,
      version: 2,
      party: [
        { classId: 'warrior', line: 'front' },
        { classId: 'ghost', line: 'back' },
      ],
    })!;
    expect(s.party.map((p) => p.classId)).toEqual(['warrior']);
  });
});
