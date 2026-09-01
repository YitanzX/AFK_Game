/**
 * The real-time auto-battler simulation.
 *
 * `stepCombat` is called with a *fixed* dt (see loop.ts). It mutates the passed
 * CombatState in place. All randomness goes through the supplied Rng, so a given
 * (seed, roster, stage) always plays out identically - which is what the tests
 * rely on.
 *
 * M1 scope: basic attacks only. Melee units close distance and hit directly;
 * ranged units fire travelling projectiles. No skills, no status effects yet -
 * the hooks (`skillCds`, effect handling) are left for M3.
 */

import type { CombatState, Projectile, RosterUnit, Stats, Unit } from './types';
import { BATTLEFIELD } from './types';
import type { Rng } from './rng';
import { basicDamage } from './formulas';
import { statsForLevel, CLASSES } from '../content/classes';
import { enemyStatsForStage, enemyBounty, ENEMIES } from '../content/enemies';
import { getStage } from '../content/stages';

/** A unit counts as ranged (fires projectiles) at or above this range. */
const RANGED_THRESHOLD = 20;
const PROJECTILE_SPEED = 140;
const FLOATER_TTL = 0.8;

export interface CombatParams {
  roster: RosterUnit[];
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
    nextId: 1,
  };

  spawnAllies(state, params.roster);
  spawnWave(state, 0);
  return state;
}

function id(state: CombatState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

function spawnAllies(state: CombatState, roster: RosterUnit[]): void {
  roster.forEach((r, index) => {
    const cls = CLASSES[r.classId];
    const stats = statsForLevel(r.classId, r.level);
    // Melee toward the front, ranged a little back.
    const x = stats.range >= RANGED_THRESHOLD ? 22 : 40;
    state.units.push(
      makeUnit(state, {
        team: 'ally',
        kind: r.classId,
        name: cls?.nameKey ?? r.classId,
        rosterIndex: index,
        x,
        y: laneY(index, roster.length),
        stats,
      }),
    );
  });
}

export function spawnWave(state: CombatState, waveIndex: number): void {
  const stageDef = getStage(state.stage);
  const wave = stageDef.waves[waveIndex];
  if (!wave) return;
  state.wave = waveIndex + 1;

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
    x: number;
    y: number;
    stats: Stats;
    goldValue?: number;
    xpValue?: number;
  },
): Unit {
  return {
    id: id(state, opts.team === 'ally' ? 'a' : 'e'),
    team: opts.team,
    kind: opts.kind,
    name: opts.name,
    rosterIndex: opts.rosterIndex,
    x: opts.x,
    y: opts.y,
    hp: opts.stats.maxHp,
    stats: opts.stats,
    attackCd: 0,
    targetId: null,
    dead: false,
    goldValue: opts.goldValue ?? 0,
    xpValue: opts.xpValue ?? 0,
    skillCds: {},
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

  for (const unit of state.units) {
    if (unit.dead) continue;
    unit.attackCd = Math.max(0, unit.attackCd - dt);

    const enemies = living(unit.team === 'ally' ? 'enemy' : 'ally');
    if (enemies.length === 0) break;

    const target = acquireTarget(unit, enemies);
    unit.targetId = target.id;

    const dist = distance(unit, target);
    if (dist > unit.stats.range) {
      moveToward(unit, target, dt);
      continue;
    }

    if (unit.attackCd <= 0) {
      performAttack(state, unit, target, rng);
      unit.attackCd = 1 / unit.stats.attackSpeed;
    }
  }

  updateProjectiles(state, dt, rng);
  updateFloaters(state, dt);
  cleanupDead(state);
  resolveOutcome(state);
}

function acquireTarget(unit: Unit, enemies: Unit[]): Unit {
  // Keep the current target if it is still alive; otherwise pick the nearest.
  if (unit.targetId) {
    const current = enemies.find((e) => e.id === unit.targetId);
    if (current) return current;
  }
  let best = enemies[0];
  let bestDist = distance(unit, best);
  for (let i = 1; i < enemies.length; i++) {
    const d = distance(unit, enemies[i]);
    if (d < bestDist) {
      best = enemies[i];
      bestDist = d;
    }
  }
  return best;
}

function performAttack(state: CombatState, source: Unit, target: Unit, rng: Rng): void {
  const roll = basicDamage(source.stats.atk, target.stats.def, {
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

function applyDamage(state: CombatState, target: Unit, amount: number, crit: boolean): void {
  if (target.dead) return;
  target.hp -= amount;
  state.floaters.push({
    id: `f${state.nextId++}`,
    x: target.x,
    y: target.y,
    text: crit ? `${amount}!` : `${amount}`,
    kind: crit ? 'crit' : 'damage',
    ttl: FLOATER_TTL,
  });
  if (target.hp <= 0) {
    target.hp = 0;
    target.dead = true;
    // Rewards come exclusively from killing enemies.
    if (target.team === 'enemy') {
      state.rewards.gold += target.goldValue;
      state.rewards.xp += target.xpValue;
      state.kills += 1;
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
    return;
  }
  if (enemies.length === 0) {
    if (state.wave >= state.totalWaves) {
      state.outcome = 'victory';
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
