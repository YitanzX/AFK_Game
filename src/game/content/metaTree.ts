/**
 * Account-wide meta skill tree. Nodes are bought with GOLD (the only gold sink
 * in the game) and are permanent — a prestige does not reset them.
 *
 * Cost for the next rank r (0-indexed) = round(baseCost * costGrowth^r).
 */

export type MetaBranch = 'offense' | 'defense' | 'economy' | 'utility';

export type MetaEffectKind =
  | 'xpMult'
  | 'goldMult'
  | 'atkMult'
  | 'hpMult'
  | 'defMult'
  | 'atkSpeedMult'
  | 'critAdd'
  | 'dropMult'
  | 'fragmentMult'
  | 'afkCapHours'
  | 'partySlots';

export interface MetaEffect {
  kind: MetaEffectKind;
  perRank: number;
}

export interface MetaNode {
  id: string;
  branch: MetaBranch;
  nameKey: string;
  descKey: string;
  maxRank: number;
  baseCost: number;
  costGrowth: number;
  /** Another node id that must be at rank >= 1 first. */
  requires?: string;
  effects: MetaEffect[];
}

export const META_BRANCHES: MetaBranch[] = ['offense', 'defense', 'economy', 'utility'];

export const META_NODES: MetaNode[] = [
  // --- offense --------------------------------------------------------
  {
    id: 'meta_atk', branch: 'offense', nameKey: 'metanode.meta_atk',
    descKey: 'metadesc.meta_atk', maxRank: 5, baseCost: 500, costGrowth: 2.3,
    effects: [{ kind: 'atkMult', perRank: 0.05 }],
  },
  {
    id: 'meta_crit', branch: 'offense', nameKey: 'metanode.meta_crit',
    descKey: 'metadesc.meta_crit', maxRank: 5, baseCost: 700, costGrowth: 2.3,
    effects: [{ kind: 'critAdd', perRank: 0.02 }],
  },
  {
    id: 'meta_power', branch: 'offense', nameKey: 'metanode.meta_power',
    descKey: 'metadesc.meta_power', maxRank: 5, baseCost: 1500, costGrowth: 2.5,
    requires: 'meta_atk',
    effects: [
      { kind: 'atkMult', perRank: 0.03 },
      { kind: 'hpMult', perRank: 0.03 },
    ],
  },

  // --- defense ------------------------------------------------------
  {
    id: 'meta_hp', branch: 'defense', nameKey: 'metanode.meta_hp',
    descKey: 'metadesc.meta_hp', maxRank: 5, baseCost: 500, costGrowth: 2.3,
    effects: [{ kind: 'hpMult', perRank: 0.05 }],
  },
  {
    id: 'meta_def', branch: 'defense', nameKey: 'metanode.meta_def',
    descKey: 'metadesc.meta_def', maxRank: 5, baseCost: 600, costGrowth: 2.3,
    effects: [{ kind: 'defMult', perRank: 0.06 }],
  },
  {
    id: 'meta_bulwark', branch: 'defense', nameKey: 'metanode.meta_bulwark',
    descKey: 'metadesc.meta_bulwark', maxRank: 5, baseCost: 1500, costGrowth: 2.5,
    requires: 'meta_hp',
    effects: [
      { kind: 'hpMult', perRank: 0.03 },
      { kind: 'defMult', perRank: 0.03 },
    ],
  },

  // --- economy ---------------------------------------------------
  {
    id: 'meta_gold', branch: 'economy', nameKey: 'metanode.meta_gold',
    descKey: 'metadesc.meta_gold', maxRank: 6, baseCost: 400, costGrowth: 2.2,
    effects: [{ kind: 'goldMult', perRank: 0.06 }],
  },
  {
    id: 'meta_xp', branch: 'economy', nameKey: 'metanode.meta_xp',
    descKey: 'metadesc.meta_xp', maxRank: 6, baseCost: 400, costGrowth: 2.2,
    effects: [{ kind: 'xpMult', perRank: 0.06 }],
  },
  {
    id: 'meta_drop', branch: 'economy', nameKey: 'metanode.meta_drop',
    descKey: 'metadesc.meta_drop', maxRank: 5, baseCost: 900, costGrowth: 2.4,
    effects: [{ kind: 'dropMult', perRank: 0.05 }],
  },
  {
    id: 'meta_frag', branch: 'economy', nameKey: 'metanode.meta_frag',
    descKey: 'metadesc.meta_frag', maxRank: 5, baseCost: 900, costGrowth: 2.4,
    effects: [{ kind: 'fragmentMult', perRank: 0.08 }],
  },

  // --- utility --------------------------------------------------
  {
    id: 'meta_afk', branch: 'utility', nameKey: 'metanode.meta_afk',
    descKey: 'metadesc.meta_afk', maxRank: 6, baseCost: 600, costGrowth: 2.3,
    effects: [{ kind: 'afkCapHours', perRank: 2 }],
  },
  {
    id: 'meta_slot', branch: 'utility', nameKey: 'metanode.meta_slot',
    descKey: 'metadesc.meta_slot', maxRank: 2, baseCost: 20000, costGrowth: 6,
    requires: 'meta_afk',
    effects: [{ kind: 'partySlots', perRank: 1 }],
  },
  {
    id: 'meta_haste', branch: 'utility', nameKey: 'metanode.meta_haste',
    descKey: 'metadesc.meta_haste', maxRank: 5, baseCost: 1200, costGrowth: 2.5,
    effects: [{ kind: 'atkSpeedMult', perRank: 0.03 }],
  },
];

export const META_NODE_BY_ID: Record<string, MetaNode> = Object.fromEntries(
  META_NODES.map((n) => [n.id, n]),
);

/** Gold cost to buy the next rank of `node`, given its current rank. */
export function nodeCost(node: MetaNode, currentRank: number): number {
  return Math.round(node.baseCost * Math.pow(node.costGrowth, Math.max(0, currentRank)));
}

/** Total gold spent to reach `rank` on `node` (for a refund). */
export function nodeSpent(node: MetaNode, rank: number): number {
  let total = 0;
  for (let r = 0; r < rank; r++) total += nodeCost(node, r);
  return total;
}

/** Template vars for a node's description at a given rank (>= 1 for preview). */
export function metaNodeVars(node: MetaNode, rank: number): Record<string, string | number> {
  const r = Math.max(1, rank);
  const e = node.effects[0];
  const raw = e.perRank * r;
  const v = e.kind === 'afkCapHours' || e.kind === 'partySlots' ? raw : Math.round(raw * 1000) / 10;
  return { v };
}
