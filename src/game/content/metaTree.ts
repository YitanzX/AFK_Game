/**
 * Account-wide meta skill tree. Nodes are bought with GOLD (the only gold sink)
 * and are permanent — a prestige does not reset them.
 *
 * Cost for the next rank r (0-indexed) = round(baseCost * costGrowth^r).
 */

export type MetaBranch =
  | 'offense'
  | 'defense'
  | 'economy'
  | 'utility'
  | 'sustain'
  | 'fortune'
  | 'mastery'
  | 'command';

export type MetaEffectKind =
  | 'xpMult'
  | 'goldMult'
  | 'atkMult'
  | 'hpMult'
  | 'defMult'
  | 'atkSpeedMult'
  | 'critAdd'
  | 'critDmgAdd'
  | 'lifestealPct'
  | 'skillCdMult'
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
  /** Another node id that must be at rank >= 1 first (same branch). */
  requires?: string;
  effects: MetaEffect[];
}

export const META_BRANCHES: MetaBranch[] = [
  'offense',
  'defense',
  'economy',
  'utility',
  'sustain',
  'fortune',
  'mastery',
  'command',
];

// helper to cut the boilerplate
function n(
  id: string,
  branch: MetaBranch,
  maxRank: number,
  baseCost: number,
  effects: MetaEffect[],
  opts: { costGrowth?: number; requires?: string } = {},
): MetaNode {
  return {
    id,
    branch,
    nameKey: `metanode.${id}`,
    descKey: `metadesc.${id}`,
    maxRank,
    baseCost,
    costGrowth: opts.costGrowth ?? 2.3,
    requires: opts.requires,
    effects,
  };
}

export const META_NODES: MetaNode[] = [
  // --- offense -----------------------------------------------------
  n('meta_atk', 'offense', 5, 500, [{ kind: 'atkMult', perRank: 0.05 }]),
  n('meta_crit', 'offense', 5, 700, [{ kind: 'critAdd', perRank: 0.02 }]),
  n('meta_critdmg', 'offense', 5, 900, [{ kind: 'critDmgAdd', perRank: 0.08 }]),
  n('meta_power', 'offense', 5, 1500, [
    { kind: 'atkMult', perRank: 0.03 },
    { kind: 'hpMult', perRank: 0.03 },
  ], { requires: 'meta_atk', costGrowth: 2.5 }),
  n('meta_berserk', 'offense', 5, 4000, [{ kind: 'atkMult', perRank: 0.06 }], {
    requires: 'meta_power',
    costGrowth: 2.6,
  }),

  // --- defense ---------------------------------------------------
  n('meta_hp', 'defense', 5, 500, [{ kind: 'hpMult', perRank: 0.05 }]),
  n('meta_def', 'defense', 5, 600, [{ kind: 'defMult', perRank: 0.06 }]),
  n('meta_bulwark', 'defense', 5, 1500, [
    { kind: 'hpMult', perRank: 0.03 },
    { kind: 'defMult', perRank: 0.03 },
  ], { requires: 'meta_hp', costGrowth: 2.5 }),
  n('meta_fortress', 'defense', 5, 2200, [{ kind: 'defMult', perRank: 0.05 }], {
    requires: 'meta_def',
  }),
  n('meta_endure', 'defense', 5, 4000, [{ kind: 'hpMult', perRank: 0.05 }], {
    requires: 'meta_bulwark',
    costGrowth: 2.6,
  }),

  // --- economy -------------------------------------------------
  n('meta_gold', 'economy', 6, 400, [{ kind: 'goldMult', perRank: 0.06 }], { costGrowth: 2.2 }),
  n('meta_xp', 'economy', 6, 400, [{ kind: 'xpMult', perRank: 0.06 }], { costGrowth: 2.2 }),
  n('meta_greed', 'economy', 5, 1200, [{ kind: 'goldMult', perRank: 0.05 }], {
    requires: 'meta_gold',
  }),
  n('meta_scholar', 'economy', 5, 1200, [{ kind: 'xpMult', perRank: 0.05 }], {
    requires: 'meta_xp',
  }),
  n('meta_tycoon', 'economy', 5, 3500, [
    { kind: 'goldMult', perRank: 0.04 },
    { kind: 'xpMult', perRank: 0.04 },
  ], { requires: 'meta_greed', costGrowth: 2.6 }),

  // --- utility -----------------------------------------------
  n('meta_afk', 'utility', 6, 600, [{ kind: 'afkCapHours', perRank: 2 }]),
  n('meta_haste', 'utility', 5, 1200, [{ kind: 'atkSpeedMult', perRank: 0.03 }], {
    costGrowth: 2.5,
  }),
  n('meta_frag', 'utility', 5, 900, [{ kind: 'fragmentMult', perRank: 0.08 }], { costGrowth: 2.4 }),
  n('meta_slot', 'utility', 1, 30000, [{ kind: 'partySlots', perRank: 1 }], {
    requires: 'meta_afk',
    costGrowth: 6,
  }),
  n('meta_tempo', 'utility', 5, 4000, [{ kind: 'atkSpeedMult', perRank: 0.03 }], {
    requires: 'meta_haste',
    costGrowth: 2.6,
  }),

  // --- sustain (NEW) --------------------------------------
  n('meta_lifesteal', 'sustain', 5, 800, [{ kind: 'lifestealPct', perRank: 0.03 }], {
    costGrowth: 2.4,
  }),
  n('meta_recovery', 'sustain', 5, 700, [{ kind: 'hpMult', perRank: 0.04 }]),
  n('meta_vitality', 'sustain', 5, 1800, [{ kind: 'hpMult', perRank: 0.05 }], {
    requires: 'meta_recovery',
    costGrowth: 2.5,
  }),
  n('meta_leech', 'sustain', 5, 2500, [{ kind: 'lifestealPct', perRank: 0.03 }], {
    requires: 'meta_lifesteal',
    costGrowth: 2.5,
  }),
  n('meta_bloodpact', 'sustain', 3, 6000, [{ kind: 'lifestealPct', perRank: 0.05 }], {
    requires: 'meta_leech',
    costGrowth: 3,
  }),

  // --- fortune (NEW) ------------------------------------
  n('meta_drop', 'fortune', 5, 900, [{ kind: 'dropMult', perRank: 0.05 }], { costGrowth: 2.4 }),
  n('meta_prospector', 'fortune', 5, 800, [{ kind: 'goldMult', perRank: 0.04 }]),
  n('meta_luck', 'fortune', 5, 2000, [{ kind: 'dropMult', perRank: 0.04 }], {
    requires: 'meta_drop',
    costGrowth: 2.5,
  }),
  n('meta_scavenger', 'fortune', 5, 1600, [{ kind: 'fragmentMult', perRank: 0.06 }], {
    requires: 'meta_prospector',
  }),
  n('meta_jackpot', 'fortune', 3, 8000, [{ kind: 'dropMult', perRank: 0.08 }], {
    requires: 'meta_luck',
    costGrowth: 3,
  }),

  // --- mastery (NEW) ----------------------------------
  n('meta_cdr', 'mastery', 5, 1500, [{ kind: 'skillCdMult', perRank: -0.03 }], {
    costGrowth: 2.5,
  }),
  n('meta_focus2', 'mastery', 5, 900, [{ kind: 'atkMult', perRank: 0.04 }]),
  n('meta_precision', 'mastery', 5, 1400, [
    { kind: 'critAdd', perRank: 0.015 },
    { kind: 'critDmgAdd', perRank: 0.05 },
  ]),
  n('meta_overdrive', 'mastery', 5, 4000, [{ kind: 'skillCdMult', perRank: -0.03 }], {
    requires: 'meta_cdr',
    costGrowth: 2.6,
  }),
  n('meta_grandmaster', 'mastery', 3, 9000, [
    { kind: 'skillCdMult', perRank: -0.02 },
    { kind: 'atkMult', perRank: 0.03 },
  ], { requires: 'meta_overdrive', costGrowth: 3 }),

  // --- command (NEW) --------------------------------
  n('meta_warband', 'command', 1, 40000, [{ kind: 'partySlots', perRank: 1 }], {
    costGrowth: 6,
  }),
  n('meta_rally', 'command', 5, 1000, [
    { kind: 'atkMult', perRank: 0.03 },
    { kind: 'hpMult', perRank: 0.03 },
  ]),
  n('meta_discipline', 'command', 5, 1200, [
    { kind: 'defMult', perRank: 0.04 },
    { kind: 'atkSpeedMult', perRank: 0.02 },
  ]),
  n('meta_veteran', 'command', 5, 2000, [
    { kind: 'xpMult', perRank: 0.04 },
    { kind: 'atkMult', perRank: 0.02 },
  ], { requires: 'meta_rally', costGrowth: 2.5 }),
  n('meta_standard', 'command', 5, 3500, [
    { kind: 'hpMult', perRank: 0.03 },
    { kind: 'defMult', perRank: 0.03 },
  ], { requires: 'meta_discipline', costGrowth: 2.6 }),
];

export const META_NODE_BY_ID: Record<string, MetaNode> = Object.fromEntries(
  META_NODES.map((node) => [node.id, node]),
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

function effectValue(kind: MetaEffectKind, raw: number): number {
  if (kind === 'afkCapHours' || kind === 'partySlots') return raw;
  return Math.round(Math.abs(raw) * 1000) / 10;
}

/** Template vars for a node's first effect (kept for back-compat). */
export function metaNodeVars(node: MetaNode, rank: number): Record<string, string | number> {
  const e = node.effects[0];
  return { v: effectValue(e.kind, e.perRank * Math.max(1, rank)) };
}

/** Localised description of every effect on a node at a given rank. */
export function describeMetaNode(
  node: MetaNode,
  rank: number,
  t: (k: string, vars?: Record<string, string | number>) => string,
): string {
  const r = Math.max(1, rank);
  return node.effects
    .map((e) => t(`mfx.${e.kind}`, { v: effectValue(e.kind, e.perRank * r) }))
    .join(' · ');
}
