/**
 * Per-class skill definitions + the skill-point maths.
 *
 * Heroes earn 1 skill point per level. Points are spent to learn a skill and to
 * raise its rank (each rank costs `costPerRank`). A skill also needs the hero to
 * be `unlockLevel` and, optionally, a prerequisite skill at rank >= 1.
 *
 * Effect magnitudes scale with the caster's LEVEL at runtime, so descriptions
 * can show a static per-level coefficient. `damage` / `aoe_damage` scale with
 * the caster's ATK instead (shown as a multiplier).
 */

import type { AffixStat } from '../core/items';

export type HealScope = 'lowest' | 'all' | 'self';

export type SkillEffect =
  | { type: 'damage'; power: number } //           bonus hit  = atk * power/100 * rank
  | { type: 'aoe_damage'; power: number } //        all enemies = atk * power/100 * rank
  | { type: 'heal'; power: number; scope: HealScope } // = level * power * rank
  | { type: 'shield'; power: number; duration: number; scope: HealScope }
  | {
      type: 'buff';
      stat: 'atk' | 'def' | 'attackSpeed';
      pct: number;
      duration: number;
      scope?: 'all' | 'self';
    }
  | { type: 'dot'; power: number; duration: number } //  dps = level * power * rank, on target
  | { type: 'taunt'; duration: number }
  | { type: 'revive'; hpPct: number };

export type SkillTrigger =
  | 'always'
  | 'allyDead'
  | 'backlineThreatened'
  | { allyHpBelow: number }
  | { selfHpBelow: number }
  | { enemiesAtLeast: number };

export interface SkillDef {
  id: string;
  classId: string;
  nameKey: string;
  descKey: string;
  kind: 'active' | 'passive';
  maxRank: number;
  costPerRank: number;
  unlockLevel: number;
  requires?: string;
  /** Lower = tried first when several skills are ready in the same tick. */
  priority: number;
  cooldown?: number;
  trigger?: SkillTrigger;
  effect?: SkillEffect;
  passiveMod?: { stat: AffixStat; perRank: number; isPercent: boolean };
}

const DEFS: SkillDef[] = [
  // --- warrior --------------------------------------------------------
  {
    id: 'warrior_cleave', classId: 'warrior', nameKey: 'skill.warrior_cleave',
    descKey: 'skilldesc.warrior_cleave', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 1, priority: 40, cooldown: 4, trigger: { enemiesAtLeast: 2 },
    effect: { type: 'aoe_damage', power: 50 },
  },
  {
    id: 'warrior_taunt', classId: 'warrior', nameKey: 'skill.warrior_taunt',
    descKey: 'skilldesc.warrior_taunt', kind: 'active', maxRank: 3, costPerRank: 1,
    unlockLevel: 5, requires: 'warrior_bash', priority: 80, cooldown: 9, trigger: 'backlineThreatened',
    effect: { type: 'taunt', duration: 4 },
  },
  {
    id: 'warrior_warcry', classId: 'warrior', nameKey: 'skill.warrior_warcry',
    descKey: 'skilldesc.warrior_warcry', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 6, requires: 'warrior_cleave', priority: 30, cooldown: 12, trigger: 'always',
    effect: { type: 'buff', stat: 'atk', pct: 12, duration: 6, scope: 'all' },
  },
  {
    id: 'warrior_ironskin', classId: 'warrior', nameKey: 'skill.warrior_ironskin',
    descKey: 'skilldesc.warrior_ironskin', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 1, priority: 0, passiveMod: { stat: 'def', perRank: 6, isPercent: true },
  },
  {
    id: 'warrior_secondwind', classId: 'warrior', nameKey: 'skill.warrior_secondwind',
    descKey: 'skilldesc.warrior_secondwind', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 8, requires: 'warrior_ironskin', priority: 90, cooldown: 14, trigger: { selfHpBelow: 45 },
    effect: { type: 'heal', power: 6, scope: 'self' },
  },

  // --- mage ----------------------------------------------------------
  {
    id: 'mage_firebolt', classId: 'mage', nameKey: 'skill.mage_firebolt',
    descKey: 'skilldesc.mage_firebolt', kind: 'active', maxRank: 6, costPerRank: 1,
    unlockLevel: 1, priority: 20, cooldown: 3, trigger: 'always',
    effect: { type: 'damage', power: 90 },
  },
  {
    id: 'mage_nova', classId: 'mage', nameKey: 'skill.mage_nova',
    descKey: 'skilldesc.mage_nova', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 3, requires: 'mage_firebolt', priority: 40, cooldown: 5, trigger: { enemiesAtLeast: 2 },
    effect: { type: 'aoe_damage', power: 45 },
  },
  {
    id: 'mage_burn', classId: 'mage', nameKey: 'skill.mage_burn',
    descKey: 'skilldesc.mage_burn', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 7, requires: 'mage_frost', priority: 25, cooldown: 6, trigger: 'always',
    effect: { type: 'dot', power: 2, duration: 4 },
  },
  {
    id: 'mage_focus', classId: 'mage', nameKey: 'skill.mage_focus',
    descKey: 'skilldesc.mage_focus', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 1, priority: 0, passiveMod: { stat: 'atk', perRank: 5, isPercent: true },
  },
  {
    id: 'mage_meteor', classId: 'mage', nameKey: 'skill.mage_meteor',
    descKey: 'skilldesc.mage_meteor', kind: 'active', maxRank: 5, costPerRank: 2,
    unlockLevel: 12, requires: 'mage_nova', priority: 50, cooldown: 12,
    trigger: { enemiesAtLeast: 3 }, effect: { type: 'aoe_damage', power: 120 },
  },

  // --- priest ------------------------------------------------------
  {
    id: 'priest_heal', classId: 'priest', nameKey: 'skill.priest_heal',
    descKey: 'skilldesc.priest_heal', kind: 'active', maxRank: 6, costPerRank: 1,
    unlockLevel: 1, priority: 70, cooldown: 3, trigger: { allyHpBelow: 65 },
    effect: { type: 'heal', power: 6, scope: 'lowest' },
  },
  {
    id: 'priest_groupheal', classId: 'priest', nameKey: 'skill.priest_groupheal',
    descKey: 'skilldesc.priest_groupheal', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 5, requires: 'priest_heal', priority: 75, cooldown: 8, trigger: { allyHpBelow: 50 },
    effect: { type: 'heal', power: 4, scope: 'all' },
  },
  {
    id: 'priest_shield', classId: 'priest', nameKey: 'skill.priest_shield',
    descKey: 'skilldesc.priest_shield', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 8, requires: 'priest_heal', priority: 60, cooldown: 7, trigger: { allyHpBelow: 80 },
    effect: { type: 'shield', power: 8, duration: 5, scope: 'lowest' },
  },
  {
    id: 'priest_faith', classId: 'priest', nameKey: 'skill.priest_faith',
    descKey: 'skilldesc.priest_faith', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 1, priority: 0, passiveMod: { stat: 'maxHp', perRank: 6, isPercent: true },
  },
  {
    id: 'priest_revive', classId: 'priest', nameKey: 'skill.priest_revive',
    descKey: 'skilldesc.priest_revive', kind: 'active', maxRank: 3, costPerRank: 2,
    unlockLevel: 13, requires: 'priest_shield', priority: 100, cooldown: 25, trigger: 'allyDead',
    effect: { type: 'revive', hpPct: 40 },
  },

  // --- rogue -----------------------------------------------------
  {
    id: 'rogue_backstab', classId: 'rogue', nameKey: 'skill.rogue_backstab',
    descKey: 'skilldesc.rogue_backstab', kind: 'active', maxRank: 6, costPerRank: 1,
    unlockLevel: 1, priority: 20, cooldown: 3, trigger: 'always',
    effect: { type: 'damage', power: 110 },
  },
  {
    id: 'rogue_poison', classId: 'rogue', nameKey: 'skill.rogue_poison',
    descKey: 'skilldesc.rogue_poison', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 3, requires: 'rogue_backstab', priority: 25, cooldown: 5, trigger: 'always',
    effect: { type: 'dot', power: 3, duration: 5 },
  },
  {
    id: 'rogue_bladedance', classId: 'rogue', nameKey: 'skill.rogue_bladedance',
    descKey: 'skilldesc.rogue_bladedance', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 6, requires: 'rogue_shadowstep', priority: 40, cooldown: 6, trigger: { enemiesAtLeast: 2 },
    effect: { type: 'aoe_damage', power: 40 },
  },
  {
    id: 'rogue_reflexes', classId: 'rogue', nameKey: 'skill.rogue_reflexes',
    descKey: 'skilldesc.rogue_reflexes', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 1, priority: 0,
    passiveMod: { stat: 'attackSpeed', perRank: 5, isPercent: true },
  },
  {
    id: 'rogue_evasion', classId: 'rogue', nameKey: 'skill.rogue_evasion',
    descKey: 'skilldesc.rogue_evasion', kind: 'active', maxRank: 4, costPerRank: 1,
    unlockLevel: 10, requires: 'rogue_reflexes', priority: 85, cooldown: 12, trigger: { selfHpBelow: 50 },
    effect: { type: 'buff', stat: 'def', pct: 40, duration: 4 },
  },

  // --- extra branches (expansion) -----------------------------------
  {
    id: 'warrior_bash', classId: 'warrior', nameKey: 'skill.warrior_bash',
    descKey: 'skilldesc.warrior_bash', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 3, requires: 'warrior_cleave', priority: 22, cooldown: 4, trigger: 'always',
    effect: { type: 'damage', power: 100 },
  },
  {
    id: 'warrior_rampage', classId: 'warrior', nameKey: 'skill.warrior_rampage',
    descKey: 'skilldesc.warrior_rampage', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 9, priority: 0, requires: 'warrior_warcry',
    passiveMod: { stat: 'atk', perRank: 4, isPercent: true },
  },
  {
    id: 'warrior_laststand', classId: 'warrior', nameKey: 'skill.warrior_laststand',
    descKey: 'skilldesc.warrior_laststand', kind: 'active', maxRank: 4, costPerRank: 1,
    unlockLevel: 14, priority: 88, cooldown: 16, trigger: { selfHpBelow: 35 },
    requires: 'warrior_secondwind',
    effect: { type: 'shield', power: 10, duration: 6, scope: 'self' },
  },

  {
    id: 'mage_frost', classId: 'mage', nameKey: 'skill.mage_frost',
    descKey: 'skilldesc.mage_frost', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 5, priority: 42, cooldown: 5, trigger: { enemiesAtLeast: 2 },
    requires: 'mage_firebolt',
    effect: { type: 'aoe_damage', power: 40 },
  },
  {
    id: 'mage_ward', classId: 'mage', nameKey: 'skill.mage_ward',
    descKey: 'skilldesc.mage_ward', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 6, requires: 'mage_focus', priority: 0,
    passiveMod: { stat: 'maxHp', perRank: 5, isPercent: true },
  },
  {
    id: 'mage_surge', classId: 'mage', nameKey: 'skill.mage_surge',
    descKey: 'skilldesc.mage_surge', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 10, priority: 32, cooldown: 12, trigger: 'always', requires: 'mage_focus',
    effect: { type: 'buff', stat: 'atk', pct: 20, duration: 6, scope: 'self' },
  },

  {
    id: 'priest_smite', classId: 'priest', nameKey: 'skill.priest_smite',
    descKey: 'skilldesc.priest_smite', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 4, requires: 'priest_faith', priority: 24, cooldown: 4, trigger: 'always',
    effect: { type: 'damage', power: 70 },
  },
  {
    id: 'priest_zeal', classId: 'priest', nameKey: 'skill.priest_zeal',
    descKey: 'skilldesc.priest_zeal', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 6, requires: 'priest_faith', priority: 0,
    passiveMod: { stat: 'atk', perRank: 4, isPercent: true },
  },
  {
    id: 'priest_sanctuary', classId: 'priest', nameKey: 'skill.priest_sanctuary',
    descKey: 'skilldesc.priest_sanctuary', kind: 'active', maxRank: 4, costPerRank: 1,
    unlockLevel: 11, priority: 65, cooldown: 14, trigger: { allyHpBelow: 70 },
    requires: 'priest_groupheal',
    effect: { type: 'shield', power: 6, duration: 6, scope: 'all' },
  },

  {
    id: 'rogue_shadowstep', classId: 'rogue', nameKey: 'skill.rogue_shadowstep',
    descKey: 'skilldesc.rogue_shadowstep', kind: 'passive', maxRank: 5, costPerRank: 1,
    unlockLevel: 4, requires: 'rogue_reflexes', priority: 0,
    passiveMod: { stat: 'critChance', perRank: 0.02, isPercent: false },
  },
  {
    id: 'rogue_ambush', classId: 'rogue', nameKey: 'skill.rogue_ambush',
    descKey: 'skilldesc.rogue_ambush', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 10, priority: 18, cooldown: 5, trigger: 'always', requires: 'rogue_backstab',
    effect: { type: 'damage', power: 150 },
  },
  {
    id: 'rogue_fan', classId: 'rogue', nameKey: 'skill.rogue_fan',
    descKey: 'skilldesc.rogue_fan', kind: 'active', maxRank: 5, costPerRank: 1,
    unlockLevel: 12, priority: 42, cooldown: 6, trigger: { enemiesAtLeast: 2 },
    requires: 'rogue_bladedance',
    effect: { type: 'aoe_damage', power: 35 },
  },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  DEFS.map((d) => [d.id, d]),
);

export function skillsForClass(classId: string): SkillDef[] {
  return DEFS.filter((d) => d.classId === classId);
}

/** Total skill points a hero has earned by `level` (1 per level). */
export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1);
}

/** Points already committed in a `skills` map. */
export function spentPoints(skills: Record<string, number>): number {
  let sum = 0;
  for (const [id, rank] of Object.entries(skills)) {
    const def = SKILLS[id];
    if (def) sum += rank * def.costPerRank;
  }
  return sum;
}

export function availablePoints(unit: { level: number; skills: Record<string, number> }): number {
  return skillPointsForLevel(unit.level) - spentPoints(unit.skills);
}

/** Template vars for a skill's description at a given rank (>= 1 for preview). */
export function skillVars(def: SkillDef, rank: number): Record<string, string | number> {
  const r = Math.max(1, rank);
  const e = def.effect;
  const cd = def.cooldown ?? 0;
  if (!e) {
    const m = def.passiveMod;
    return { v: m ? m.perRank * r : 0 };
  }
  switch (e.type) {
    case 'damage':
    case 'aoe_damage':
      return { v: round2((e.power / 100) * r), cd };
    case 'heal':
      return { v: e.power * r, cd };
    case 'dot':
      return { v: e.power * r, d: e.duration, cd };
    case 'shield':
      return { v: e.power * r, d: e.duration, cd };
    case 'buff':
      return { v: e.pct * r, d: e.duration, cd };
    case 'taunt':
      return { d: e.duration, cd };
    case 'revive':
      return { v: e.hpPct, cd };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
