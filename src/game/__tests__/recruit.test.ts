import { describe, it, expect } from 'vitest';
import { applyFragments, recruitCost, nextLockedClass, RECRUIT_ORDER } from '../systems/recruit';
import { hero, STARTER_PARTY } from './_fixtures';

const start = () => ({ roster: [hero('warrior', 10), hero('mage', 10)], party: [...STARTER_PARTY] });

describe('applyFragments', () => {
  it('accumulates toward the next locked class without unlocking early', () => {
    const { roster, party } = start();
    const r = applyFragments(roster, party, {}, 10);
    expect(r.recruited).toEqual([]);
    expect(r.fragments.priest).toBe(10);
    expect(r.roster).toHaveLength(2);
  });

  it('unlocks a class when its cost is reached and fields it', () => {
    const { roster, party } = start();
    const r = applyFragments(roster, party, {}, recruitCost('priest'));
    expect(r.recruited).toEqual(['priest']);
    expect(r.roster.some((u) => u.classId === 'priest')).toBe(true);
    expect(r.party.some((p) => p.classId === 'priest')).toBe(true);
    expect(r.fragments.priest).toBe(0);
  });

  it('cascades leftover fragments to the next class', () => {
    const { roster, party } = start();
    const over = recruitCost('priest') + 40;
    const r = applyFragments(roster, party, {}, over);
    expect(r.recruited).toEqual(['priest']);
    expect(r.fragments.rogue).toBe(40);
  });

  it('can unlock several classes in one big grant', () => {
    const { roster, party } = start();
    const total = recruitCost('priest') + recruitCost('rogue');
    const r = applyFragments(roster, party, {}, total);
    expect(r.recruited).toEqual(['priest', 'rogue']);
    expect(nextLockedClass(r.roster)).toBeNull();
  });

  it('recruits near 60% of the average fielded level', () => {
    const roster = [hero('warrior', 20), hero('mage', 20)];
    const r = applyFragments(roster, [...STARTER_PARTY], {}, recruitCost('priest'));
    const priest = r.roster.find((u) => u.classId === 'priest')!;
    expect(priest.level).toBe(12); // floor(20 * 0.6)
  });

  it('wastes fragments once everything is unlocked', () => {
    let roster = [hero('warrior', 5), hero('mage', 5)];
    let party = [...STARTER_PARTY];
    for (const c of RECRUIT_ORDER) {
      const res = applyFragments(roster, party, {}, recruitCost(c));
      roster = res.roster;
      party = res.party;
    }
    const r = applyFragments(roster, party, {}, 5000);
    expect(r.recruited).toEqual([]);
    expect(r.roster).toHaveLength(4);
  });
});
