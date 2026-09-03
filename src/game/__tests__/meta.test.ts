import { describe, it, expect } from 'vitest';
import { computeMetaBonuses } from '../systems/meta';
import { META_NODE_BY_ID, nodeCost, nodeSpent } from '../content/metaTree';

describe('computeMetaBonuses', () => {
  it('is neutral with an empty tree', () => {
    const b = computeMetaBonuses({});
    expect(b.xpMult).toBe(1);
    expect(b.atkMult).toBe(1);
    expect(b.critAdd).toBe(0);
    expect(b.afkCapHours).toBe(12);
    expect(b.partySlots).toBe(4);
  });

  it('adds a node effect per rank', () => {
    // meta_xp: +0.06 xpMult per rank
    expect(computeMetaBonuses({ metaTree: { meta_xp: 3 } }).xpMult).toBeCloseTo(1.18, 5);
  });

  it('stacks effects from different nodes on the same field', () => {
    const b = computeMetaBonuses({ metaTree: { meta_atk: 2, meta_power: 2 } });
    // meta_atk +0.05*2, meta_power +0.03*2
    expect(b.atkMult).toBeCloseTo(1 + 0.1 + 0.06, 5);
    expect(b.hpMult).toBeCloseTo(1 + 0.06, 5);
  });

  it('utility nodes raise afk cap and party slots', () => {
    const b = computeMetaBonuses({ metaTree: { meta_afk: 4, meta_slot: 1, meta_warband: 1 } });
    expect(b.afkCapHours).toBe(12 + 8);
    expect(b.partySlots).toBe(4 + 2); // meta_slot + meta_warband
  });

  it('clamps a rank above maxRank', () => {
    const node = META_NODE_BY_ID.meta_xp;
    const over = computeMetaBonuses({ metaTree: { meta_xp: 999 } }).xpMult;
    const atMax = computeMetaBonuses({ metaTree: { meta_xp: node.maxRank } }).xpMult;
    expect(over).toBe(atMax);
  });

  it('folds in relic upgrades', () => {
    const b = computeMetaBonuses({ prestigeUpgrades: { relic_xp: 4 } });
    expect(b.xpMult).toBeCloseTo(1.2, 5); // +5% * 4
  });
});

describe('node cost maths', () => {
  it('grows with rank', () => {
    const node = META_NODE_BY_ID.meta_atk;
    expect(nodeCost(node, 3)).toBeGreaterThan(nodeCost(node, 0) * 2);
  });

  it('nodeSpent is the sum of the ranks bought', () => {
    const node = META_NODE_BY_ID.meta_gold;
    expect(nodeSpent(node, 3)).toBe(nodeCost(node, 0) + nodeCost(node, 1) + nodeCost(node, 2));
    expect(nodeSpent(node, 0)).toBe(0);
  });
});
