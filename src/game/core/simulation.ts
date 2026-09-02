/**
 * The real-time auto-battler simulation.
 *
 * `stepCombat` is called with a *fixed* dt (see loop.ts). It mutates the passed
 * CombatState in place. All randomness goes through the supplied Rng, so a given
 * (seed, party, stage) always plays out identically - which is what the tests
 * rely on.
 *
 * Each tick a unit tries, in order: cast a ready skill whose trigger fires
 * (allies only), else move toward its target, else basic-attack. Status effects
 * (buffs / dots / shields / taunt) and class traits resolve after the unit loop.
 */

import type {
  CombatState,
  LogEntry,
  LogKind,
  Projectile,
  ResolvedHero,
  ResolvedSkill,
  Stats,
  Unit,
} from './types';
import { BATTLEFIELD } from './types';
import type { Rng } from './rng';
import { basicDamage } from './formulas';
import { CLASSES } from '../content/classes';
import { enemyStatsForStage, enemyBounty, ENEMIES } from '../content/enemies';
import { getStage } from '../content/stages';
import { shouldCast, type CastContext } from '../systems/skills';

/** A unit counts as ranged (fires projectiles) at or above this range. */
const RANGED_THRESHOLD = 20;
const PROJECTILE_SPEED = 140;
const FLOATER_TTL = 0.8;
const LOG_CAP = 40;

export interface CombatParams {
  /** The active party, already resolved to derived stats + placement. */
  party: ResolvedHero[];
  stage: number;
  attempt: number;
}

export function createCombat(params: CombatParams): CombatState {
  const stageDef = getStage(params.stage);
  const state: CombatState = {
    stage: params.stage,
    attempt: params.attempt,
    wave: 0,
    totalWaves: stageDef.waves.length,
    units: [],
    projectiles: [],
    floaters: [],
    outcome: 'ongoing',
    elapsed: 0,
    rewards: { gold: 0, xp: 0 },
    kills: 0,
    fragments: 0,
    log: [],
    fallen: [],
    tauntTargetId: null,
    nextId: 1,
  };

  spawnAllies(state, params.party);
  spawnWave(state, 0);
  return state;
}

function pushLog(
  state: CombatState,
  kind: LogKind,
  key: string,
  vars?: Record<string, string | number>,
): void {
  const entry: LogEntry = { id: state.nextId++, at: state.elapsed, kind, key, vars };
  state.log.push(entry);
  if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP);
}

function id(state: CombatState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

function spawnAllies(state: CombatState, party: ResolvedHero[]): void {
  party.forEach((hero) => {
    const cls = CLASSES[hero.classId];
    // Front line holds the line; back line hangs back a bit further.
    const x = hero.line === 'front' ? 42 : 20;
    state.units.push(
      makeUnit(state, {
        team: 'ally',
        kind: hero.classId,
        name: cls?.nameKey ?? hero.classId,
        rosterIndex: hero.partyIndex,
        level: hero.level,
        line: hero.line,
        x,
        y: laneY(hero.partyIndex, party.length),
        stats: hero.stats,
        activeSkills: hero.skills.filter((s) => s.def.kind === 'active'),
      }),
    );
  });
}

export function spawnWave(state: CombatState, waveIndex: number): void {
  const stageDef = getStage(state.stage);
  const wave = stageDef.waves[waveIndex];
  if (!wave) return;
  state.wave = waveIndex + 1;
  pushLog(state, 'wave', wave.isBoss ? 'log.boss' : 'log.wave', {
    n: state.wave,
    total: state.totalWaves,
  });

  wave.enemies.forEach((enemyId, i) => {
    const enemy = ENEMIES[enemyId];
    const stats = enemyStatsForStage(enemyId, state.stage);
    const bounty = enemyBounty(enemyId, state.stage);
    state.units.push(
      makeUnit(state, {
        team: 'enemy',
        kind: enemyId,
        name: enemy?.nameKey ?? enemyId,
        rosterIndex: -1,
        x: BATTLEFIELD.width - 20 - (i % 2) * 12,
        y: laneY(i, wave.enemies.length),
        stats,
        goldValue: bounty.gold,
        xpValue: bounty.xp,
      }),
    );
  });
}

function makeUnit(
  state: CombatState,
  opts: {
    team: Unit['team'];
    kind: string;
    name: string;
    rosterIndex: number;
    level?: number;
    line?: 'front' | 'back';
    x: number;
    y: number;
    stats: Stats;
    goldValue?: number;
    xpValue?: number;
    activeSkills?: ResolvedSkill[];
  },
): Unit {
  const activeSkills = opts.activeSkills ?? [];
  const skillCds: Record<string, number> = {};
  for (const s of activeSkills) {
    // Small deterministic stagger so a full loadout doesn't all fire on tick 1.
    skillCds[s.id] = s.def.cooldown ? Math.min(1.5, s.def.cooldown * 0.35) : 0;
  }
  return {
    id: id(state, opts.team === 'ally' ? 'a' : 'e'),
    team: opts.team,
    kind: opts.kind,
    name: opts.name,
    rosterIndex: opts.rosterIndex,
    level: opts.level ?? 0,
    line: opts.line,
    x: opts.x,
    y: opts.y,
    hp: opts.stats.maxHp,
    stats: opts.stats,
    attackCd: 0,
    targetId: null,
    dead: false,
    goldValue: opts.goldValue ?? 0,
    xpValue: opts.xpValue ?? 0,
    activeSkills,
    skillCds,
    shield: 0,
    shieldUntil: 0,
    statusEffects: [],
    tauntUntil: 0,
  };
}

/** Spread N units vertically down the battlefield. */
function laneY(index: number, count: number): number {
  if (count <= 1) return BATTLEFIELD.height / 2;
  const margin = 16;
  const usable = BATTLEFIELD.height - margin * 2;
  return margin + (usable * index) / (count - 1);
}

// --- per-tick update --------------------------------------------------------

export function stepCombat(state: CombatState, dt: number, rng: Rng): void {
  if (state.outcome !== 'ongoing') return;
  state.elapsed += dt;

  const living = (team: Unit['team']) =>
    state.units.filter((u) => u.team === team && !u.dead);

  // Snapshot: a revive can push a unit mid-loop; it acts next tick.
  for (const unit of [...state.units]) {
    if (unit.dead) continue;
    unit.attackCd = Math.max(0, unit.attackCd - dt);
    for (const sid of Object.keys(unit.skillCds)) {
      unit.skillCds[sid] = Math.max(0, unit.skillCds[sid] - dt);
    }

    const foes = living(unit.team === 'ally' ? 'enemy' : 'ally');
    if (foes.length === 0) break;

    // 1) cast a ready skill whose trigger fires (allies only)
    if (unit.team === 'ally' && unit.activeSkills.length > 0) {
      const ctx: CastContext = {
        self: unit,
        allies: living('ally'),
        enemies: foes,
        hasFallen: state.fallen.length > 0,
      };
      let cast = false;
      for (const rs of unit.activeSkills) {
        if ((unit.skillCds[rs.id] ?? 0) > 0) continue;
        if (!shouldCast(rs.def.trigger, ctx)) continue;
        castSkill(state, unit, rs, rng);
        unit.skillCds[rs.id] = rs.def.cooldown ?? 0;
        cast = true;
        break;
      }
      if (cast) continue;
    }

    // 2) move toward / 3) basic-attack the target
    const target = acquireTarget(state, unit, foes);
    unit.targetId = target.id;

    if (distance(unit, target) > unit.stats.range) {
      moveToward(unit, target, dt);
      continue;
    }
    if (unit.attackCd <= 0) {
      performAttack(state, unit, target, rng);
      unit.attackCd = 1 / Math.max(0.2, effectiveStat(unit, 'attackSpeed'));
    }
  }

  applyClassTraits(state, dt, rng);
  tickStatuses(state, dt, rng);
  updateProjectiles(state, dt, rng);
  updateFloaters(state, dt);
  cleanupDead(state);
  resolveOutcome(state);
}

/** A stat after timed buffs (multiplicative). */
function effectiveStat(u: Unit, key: 'atk' | 'def' | 'attackSpeed'): number {
  let v = u.stats[key];
  for (const e of u.statusEffects) {
    if (e.kind === 'buff' && e.stat === key && e.mult) v *= e.mult;
  }
  return v;
}

/** Damage-over-time ticks + expiry of buffs / shields. */
function tickStatuses(state: CombatState, dt: number, rng: Rng): void {
  for (const u of state.units) {
    if (u.dead) continue;

    let dotDps = 0;
    for (const e of u.statusEffects) {
      if (e.kind === 'dot' && e.dps) dotDps += e.dps;
    }
    if (dotDps > 0) {
      u.hp -= dotDps * dt;
      if (rng.chance(dt * 2.5)) {
        spawnFloater(state, u, `${Math.max(1, Math.round(dotDps))}`, 'damage');
      }
      if (u.hp <= 0) {
        registerDeath(state, u);
        continue;
      }
    }

    u.statusEffects = u.statusEffects.filter((e) => e.until > state.elapsed);
    if (u.shield > 0 && state.elapsed >= u.shieldUntil) u.shield = 0;
  }
}

/** Always-on passives (M2: priest party-wide regen). */
function applyClassTraits(state: CombatState, dt: number, rng: Rng): void {
  let regenPerSec = 0;
  for (const u of state.units) {
    if (u.dead || u.team !== 'ally') continue;
    const trait = CLASSES[u.kind]?.trait;
    if (trait?.kind === 'regen') regenPerSec += trait.perLevel * Math.max(1, u.level);
  }
  if (regenPerSec <= 0) return;

  const heal = regenPerSec * dt;
  for (const u of state.units) {
    if (u.dead || u.team !== 'ally' || u.hp >= u.stats.maxHp) continue;
    u.hp = Math.min(u.stats.maxHp, u.hp + heal);
    // Occasional heal number so it reads on screen without spamming.
    if (rng.chance(dt * 1.2)) {
      state.floaters.push({
        id: `f${state.nextId++}`,
        x: u.x,
        y: u.y,
        text: `+${Math.max(1, Math.round(regenPerSec))}`,
        kind: 'heal',
        ttl: FLOATER_TTL,
      });
    }
  }
}

function acquireTarget(state: CombatState, unit: Unit, foes: Unit[]): Unit {
  // Enemies are forced onto an active taunter.
  if (unit.team === 'enemy' && state.tauntTargetId) {
    const taunter = foes.find((f) => f.id === state.tauntTargetId);
    if (taunter && state.elapsed < taunter.tauntUntil) return taunter;
  }
  // Keep the current target if it is still alive; otherwise pick the nearest.
  if (unit.targetId) {
    const current = foes.find((e) => e.id === unit.targetId);
    if (current) return current;
  }
  return nearest(unit, foes);
}

function nearest(from: { x: number; y: number }, list: Unit[]): Unit {
  let best = list[0];
  let bestDist = distance(from, best);
  for (let i = 1; i < list.length; i++) {
    const d = distance(from, list[i]);
    if (d < bestDist) {
      best = list[i];
      bestDist = d;
    }
  }
  return best;
}

function lowestHpRatio(units: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestR = Infinity;
  for (const u of units) {
    const r = u.hp / u.stats.maxHp;
    if (r < bestR) {
      best = u;
      bestR = r;
    }
  }
  return best;
}

function performAttack(state: CombatState, source: Unit, target: Unit, rng: Rng): void {
  const roll = basicDamage(effectiveStat(source, 'atk'), effectiveStat(target, 'def'), {
    rng,
    critChance: source.stats.critChance,
    critDmg: source.stats.critDmg,
  });

  if (source.stats.range >= RANGED_THRESHOLD) {
    state.projectiles.push({
      id: `p${state.nextId++}`,
      team: source.team,
      sourceId: source.id,
      targetId: target.id,
      x: source.x,
      y: source.y,
      speed: PROJECTILE_SPEED,
      damage: roll.amount,
      crit: roll.crit,
    });
  } else {
    applyDamage(state, target, roll.amount, roll.crit);
  }
}

function updateProjectiles(state: CombatState, dt: number, _rng: Rng): void {
  const next: Projectile[] = [];
  for (const p of state.projectiles) {
    const target = state.units.find((u) => u.id === p.targetId);
    if (!target || target.dead) continue; // fizzle

    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    const travel = p.speed * dt;

    if (d <= travel + 3) {
      applyDamage(state, target, p.damage, p.crit);
      continue;
    }
    p.x += (dx / d) * travel;
    p.y += (dy / d) * travel;
    next.push(p);
  }
  state.projectiles = next;
}

function spawnFloater(
  state: CombatState,
  at: { x: number; y: number },
  text: string,
  kind: 'damage' | 'crit' | 'heal',
): void {
  state.floaters.push({ id: `f${state.nextId++}`, x: at.x, y: at.y, text, kind, ttl: FLOATER_TTL });
}

function applyDamage(state: CombatState, target: Unit, amount: number, crit: boolean): void {
  if (target.dead || amount <= 0) return;

  let dmg = amount;
  if (target.shield > 0) {
    const soak = Math.min(target.shield, dmg);
    target.shield -= soak;
    dmg -= soak;
    if (dmg <= 0) {
      spawnFloater(state, target, '0', 'damage');
      return;
    }
  }

  const shown = Math.max(1, Math.round(dmg));
  target.hp -= dmg;
  spawnFloater(state, target, crit ? `${shown}!` : `${shown}`, crit ? 'crit' : 'damage');
  if (target.hp <= 0) registerDeath(state, target);
}

/** Flag a death and settle its consequences (rewards, or a fallen-ally record). */
function registerDeath(state: CombatState, unit: Unit): void {
  if (unit.dead) return;
  unit.hp = 0;
  unit.dead = true;

  if (unit.team === 'enemy') {
    // Rewards come exclusively from killing enemies.
    state.rewards.gold += unit.goldValue;
    state.rewards.xp += unit.xpValue;
    state.kills += 1;
    state.fragments += ENEMIES[unit.kind]?.fragments ?? 0;
  } else {
    state.fallen.push({
      rosterIndex: unit.rosterIndex,
      kind: unit.kind,
      name: unit.name,
      level: unit.level,
      line: unit.line ?? 'back',
      stats: unit.stats,
      activeSkills: unit.activeSkills,
      x: unit.x,
      y: unit.y,
    });
    pushLog(state, 'death', 'log.death', { name: unit.name });
  }
}

function addOrRefreshStatus(u: Unit, eff: Unit['statusEffects'][number]): void {
  const existing = u.statusEffects.find((s) => s.source === eff.source);
  if (existing) Object.assign(existing, eff);
  else u.statusEffects.push(eff);
}

function pickEnemyTarget(caster: Unit, enemies: Unit[]): Unit | null {
  if (enemies.length === 0) return null;
  if (caster.targetId) {
    const cur = enemies.find((e) => e.id === caster.targetId);
    if (cur) return cur;
  }
  return nearest(caster, enemies);
}

/** Apply one skill's effect. Mutates `state`. */
function castSkill(state: CombatState, caster: Unit, rs: ResolvedSkill, rng: Rng): void {
  const e = rs.def.effect;
  if (!e) return;
  const enemies = state.units.filter((u) => !u.dead && u.team !== caster.team);
  const allies = state.units.filter((u) => !u.dead && u.team === caster.team);
  const rank = rs.rank;

  const logCast = (kind: LogKind = 'skill', extra?: Record<string, string | number>) =>
    pushLog(state, kind, kind === 'heal' ? 'log.heal' : 'log.cast', {
      caster: caster.name,
      skill: rs.def.nameKey,
      ...extra,
    });

  const nuke = (tgt: Unit) => {
    const crit = rng.chance(caster.stats.critChance);
    const dmg =
      effectiveStat(caster, 'atk') * (('power' in e ? e.power : 0) / 100) * rank *
      (crit ? caster.stats.critDmg : 1);
    applyDamage(state, tgt, Math.round(dmg), crit);
  };

  switch (e.type) {
    case 'damage': {
      const tgt = pickEnemyTarget(caster, enemies);
      if (!tgt) return;
      nuke(tgt);
      logCast();
      break;
    }
    case 'aoe_damage': {
      if (enemies.length === 0) return;
      for (const tgt of [...enemies]) nuke(tgt);
      logCast();
      break;
    }
    case 'heal': {
      const amount = Math.max(1, Math.round(Math.max(1, caster.level) * e.power * rank));
      const targets =
        e.scope === 'all' ? allies : e.scope === 'self' ? [caster] : [lowestHpRatio(allies)];
      for (const t of targets) {
        if (!t || t.hp >= t.stats.maxHp) continue;
        t.hp = Math.min(t.stats.maxHp, t.hp + amount);
        spawnFloater(state, t, `+${amount}`, 'heal');
      }
      logCast('heal', { v: amount });
      break;
    }
    case 'shield': {
      const amount = Math.max(1, Math.round(Math.max(1, caster.level) * e.power * rank));
      const targets =
        e.scope === 'all' ? allies : e.scope === 'self' ? [caster] : [lowestHpRatio(allies)];
      for (const t of targets) {
        if (!t) continue;
        t.shield = Math.max(t.shield, amount);
        t.shieldUntil = state.elapsed + e.duration;
        spawnFloater(state, t, `+${amount}`, 'heal');
      }
      logCast();
      break;
    }
    case 'buff': {
      const mult = 1 + (e.pct * rank) / 100;
      const targets = e.scope === 'all' ? allies : [caster];
      for (const t of targets) {
        addOrRefreshStatus(t, {
          kind: 'buff',
          stat: e.stat,
          mult,
          until: state.elapsed + e.duration,
          source: rs.id,
        });
      }
      logCast();
      break;
    }
    case 'dot': {
      const tgt = pickEnemyTarget(caster, enemies);
      if (!tgt) return;
      const dps = Math.max(1, Math.round(Math.max(1, caster.level) * e.power * rank));
      addOrRefreshStatus(tgt, {
        kind: 'dot',
        dps,
        until: state.elapsed + e.duration,
        source: rs.id,
      });
      logCast();
      break;
    }
    case 'taunt': {
      state.tauntTargetId = caster.id;
      caster.tauntUntil = state.elapsed + e.duration;
      logCast();
      break;
    }
    case 'revive': {
      const f = state.fallen.shift();
      if (!f) return;
      const u = makeUnit(state, {
        team: 'ally',
        kind: f.kind,
        name: f.name,
        rosterIndex: f.rosterIndex,
        level: f.level,
        line: f.line,
        x: f.x,
        y: f.y,
        stats: f.stats,
        activeSkills: f.activeSkills,
      });
      u.hp = Math.max(1, Math.round(f.stats.maxHp * (e.hpPct / 100)));
      state.units.push(u);
      pushLog(state, 'revive', 'log.revive', { caster: caster.name, target: f.name });
      break;
    }
  }
}

function updateFloaters(state: CombatState, dt: number): void {
  for (const f of state.floaters) {
    f.ttl -= dt;
    f.y -= 18 * dt; // drift upward
  }
  state.floaters = state.floaters.filter((f) => f.ttl > 0);
}

function cleanupDead(state: CombatState): void {
  if (!state.units.some((u) => u.dead)) return;
  state.units = state.units.filter((u) => !u.dead);
  state.projectiles = state.projectiles.filter((p) =>
    state.units.some((u) => u.id === p.targetId),
  );
}

function resolveOutcome(state: CombatState): void {
  const allies = state.units.filter((u) => u.team === 'ally');
  const enemies = state.units.filter((u) => u.team === 'enemy');

  if (allies.length === 0) {
    state.outcome = 'defeat';
    pushLog(state, 'result', 'log.defeat');
    return;
  }
  if (enemies.length === 0) {
    if (state.wave >= state.totalWaves) {
      state.outcome = 'victory';
      pushLog(state, 'result', 'log.victory');
    } else {
      spawnWave(state, state.wave); // state.wave is 1-based -> next index
    }
  }
}

// --- geometry helpers ------------------------------------------------------

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(unit: Unit, target: Unit, dt: number): void {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const d = Math.hypot(dx, dy) || 1;
  const step = unit.stats.moveSpeed * dt;
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
}
