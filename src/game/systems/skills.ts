/**
 * Skill helpers used outside the simulation:
 *  - `resolveSkills`: a hero's purchased skills, ranked, ready for the sim;
 *  - `passiveStatMods`: passive skill contributions for `deriveUnitStats`;
 *  - `shouldCast`: evaluate a skill's trigger against a combat snapshot.
 *
 * The actual effect application lives in `core/simulation.ts` (it needs unit
 * construction, damage helpers and the log).
 */

import type { AffixStat } from '../core/items';
import type { ResolvedSkill, RosterUnit, Unit } from '../core/types';
import { SKILLS, skillVars, type SkillTrigger } from '../content/skills';

/** Purchased (rank >= 1) skills for a hero, resolved to rank + display power. */
export function resolveSkills(unit: RosterUnit): ResolvedSkill[] {
  const out: ResolvedSkill[] = [];
  for (const [id, rank] of Object.entries(unit.skills ?? {})) {
    const def = SKILLS[id];
    if (!def || rank < 1) continue;
    out.push({ id, def, rank, power: Number(skillVars(def, rank).v ?? 0) });
  }
  // Actives first, sorted by their cast priority.
  return out.sort((a, b) => a.def.priority - b.def.priority);
}

/** Only the *active* skills, in the order the AI should try to cast them. */
export function activeSkills(unit: RosterUnit): ResolvedSkill[] {
  return resolveSkills(unit).filter((s) => s.def.kind === 'active');
}

export interface PassiveMod {
  stat: AffixStat;
  value: number;
  isPercent: boolean;
}

export function passiveStatMods(unit: RosterUnit): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const [id, rank] of Object.entries(unit.skills ?? {})) {
    const def = SKILLS[id];
    if (!def?.passiveMod || rank < 1) continue;
    out.push({
      stat: def.passiveMod.stat,
      value: def.passiveMod.perRank * rank,
      isPercent: def.passiveMod.isPercent,
    });
  }
  return out;
}

export interface CastContext {
  self: Unit;
  /** living allies (includes self) */
  allies: Unit[];
  /** living enemies */
  enemies: Unit[];
  hasFallen: boolean;
}

export function shouldCast(trigger: SkillTrigger | undefined, ctx: CastContext): boolean {
  if (!trigger) return false;
  if (trigger === 'always') return ctx.enemies.length > 0;
  if (trigger === 'allyDead') return ctx.hasFallen;
  if (trigger === 'backlineThreatened') {
    const backIds = new Set(ctx.allies.filter((a) => a.line === 'back').map((a) => a.id));
    return ctx.enemies.some((e) => e.targetId != null && backIds.has(e.targetId));
  }
  if ('allyHpBelow' in trigger) {
    return ctx.allies.some((a) => a.hp / a.stats.maxHp < trigger.allyHpBelow / 100);
  }
  if ('selfHpBelow' in trigger) {
    return ctx.self.hp / ctx.self.stats.maxHp < trigger.selfHpBelow / 100;
  }
  if ('enemiesAtLeast' in trigger) {
    return ctx.enemies.length >= trigger.enemiesAtLeast;
  }
  return false;
}
