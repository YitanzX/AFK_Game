/**
 * CombatScene — turns a (read-only) CombatState snapshot into an animated 2D
 * battle. Holds all the render-only animation state (eased positions, attack /
 * hit timers, particles, death topples, screen shake) so the simulation itself
 * stays pure and deterministic.
 *
 * Coordinate spaces:
 *  - the simulation works in logical units (0..200 x 0..100);
 *  - `project()` maps those to screen pixels with a shallow fake-perspective
 *    lane (back lane sits just under the horizon, front lane lower and larger);
 *  - particles are stored and simulated in SCREEN pixels, so anything that
 *    spawns them must project the source position first.
 */

import type { CombatState, Projectile, Unit } from '../../game/core/types';
import { BATTLEFIELD } from '../../game/core/types';
import { drawBackground, HORIZON } from './background';
import { drawSprite, type SpritePose } from './sprites';
import { Particles, drawHpBar, drawFloater } from './effects';
import { KIND, TEAM, PROJECTILE } from './palette';

interface UnitAnim {
  simX: number;
  simY: number;
  rx: number;
  ry: number;
  prevHp: number;
  prevCd: number;
  chip: number;
  spawn: number;
  facing: 1 | -1;
  kind: string;
  pose: SpritePose;
}

interface DeathAnim {
  x: number;
  y: number;
  kind: string;
  facing: 1 | -1;
  t: number;
  tint: { a: string; b: string; c: string };
}

interface Projected {
  x: number;
  y: number;
  scale: number;
}

const KIND_SCALE: Record<string, number> = {
  ogre: 1.75,
  orc: 1.3,
  warrior: 1.08,
  mage: 1.0,
  priest: 1.0,
  rogue: 0.9,
  goblin: 0.82,
  archer: 0.82,
};

/** Vertical lane span the sim actually uses (see `laneY` in simulation.ts). */
const LANE_MIN = 16;
const LANE_MAX = BATTLEFIELD.height - 16;

function easeFactor(dt: number, rate: number): number {
  return 1 - Math.exp(-dt * rate);
}

function tintFor(kind: string) {
  return KIND[kind] ?? KIND.goblin;
}

export class CombatScene {
  private anims = new Map<string, UnitAnim>();
  private deaths: DeathAnim[] = [];
  private particles = new Particles();
  private projLast = new Map<string, { x: number; y: number; team: 'ally' | 'enemy' }>();
  private time = 0;
  private shake = 0;
  private flash = { r: 0, g: 0, b: 0, a: 0 };
  private prevOutcome: CombatState['outcome'] = 'ongoing';
  private lastCombat: CombatState | null = null;
  private w = 0;
  private h = 0;

  /** Logical (0..200, 0..100) -> screen pixels, on a shallow ground plane. */
  private project(lx: number, ly: number): Projected {
    const t = Math.max(0, Math.min(1, (ly - LANE_MIN) / (LANE_MAX - LANE_MIN)));
    const groundY = this.h * HORIZON;
    const padX = this.w * 0.06;
    return {
      x: padX + (lx / BATTLEFIELD.width) * (this.w - padX * 2),
      // back lane (t=0) sits just below the horizon; front lane lower.
      y: groundY + this.h * 0.015 + t * this.h * 0.14,
      scale: 0.85 + t * 0.28,
    };
  }

  private get unitPx(): number {
    return Math.max(24, Math.min(60, this.h * 0.15));
  }

  /** Screen-space point around a unit's torso, for spawning particles. */
  private torsoPoint(lx: number, ly: number): { x: number; y: number } {
    const p = this.project(lx, ly);
    return { x: p.x, y: p.y - this.unitPx * 0.55 };
  }

  update(combat: CombatState, dt: number, w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 60);
    this.flash.a = Math.max(0, this.flash.a - dt * 1.6);

    // A new battle replaces the whole CombatState object — drop stale anim
    // state (entity ids are reused across battles).
    if (combat !== this.lastCombat) {
      this.anims.clear();
      this.deaths.length = 0;
      this.projLast.clear();
      this.shake = 0;
      this.prevOutcome = 'ongoing';
      this.lastCombat = combat;
    }

    const seen = new Set<string>();

    for (const u of combat.units) {
      seen.add(u.id);
      let a = this.anims.get(u.id);
      if (!a) {
        a = {
          simX: u.x,
          simY: u.y,
          rx: u.x,
          ry: u.y,
          prevHp: u.hp,
          prevCd: u.attackCd,
          chip: u.hp / u.stats.maxHp,
          spawn: 0,
          facing: u.team === 'ally' ? 1 : -1,
          kind: u.kind,
          pose: {
            attack: 0,
            hit: 0,
            step: Math.random() * 6,
            walking: false,
            bob: Math.random() * 6,
          },
        };
        this.anims.set(u.id, a);
      }

      const moving = Math.abs(u.x - a.simX) > 0.02 || Math.abs(u.y - a.simY) > 0.02;
      a.simX = u.x;
      a.simY = u.y;
      a.rx += (u.x - a.rx) * easeFactor(dt, 14);
      a.ry += (u.y - a.ry) * easeFactor(dt, 14);

      const torso = this.torsoPoint(a.rx, a.ry);

      // just attacked: cooldown jumped back up
      if (u.attackCd - a.prevCd > 0.05) {
        a.pose.attack = 1;
        if (u.stats.range < 20) {
          this.particles.burst(torso.x, torso.y, a.facing === 1 ? 0 : Math.PI, 5, '#ffe6b0');
        }
      }
      a.prevCd = u.attackCd;

      // took damage
      if (u.hp < a.prevHp - 0.5) {
        a.pose.hit = 1;
        this.shake = Math.min(9, this.shake + 2.5);
        this.particles.burst(torso.x, torso.y, a.facing === 1 ? Math.PI : 0, 6, TEAM[u.team].ring);
      }
      a.prevHp = u.hp;

      const target = u.hp / u.stats.maxHp;
      a.chip = target < a.chip ? a.chip + (target - a.chip) * easeFactor(dt, 3) : target;

      a.pose.attack = Math.max(0, a.pose.attack - dt / 0.28);
      a.pose.hit = Math.max(0, a.pose.hit - dt / 0.25);
      a.pose.walking = moving;
      a.pose.step += dt * (moving ? 13 : 3);
      a.pose.bob += dt * 3;
      a.spawn = Math.min(1, a.spawn + dt / 0.3);
    }

    // units that vanished this frame -> death topple + pop
    for (const [id, a] of this.anims) {
      if (seen.has(id)) continue;
      this.deaths.push({
        x: a.rx,
        y: a.ry,
        kind: a.kind,
        facing: a.facing,
        t: 0,
        tint: tintFor(a.kind),
      });
      const tp = this.torsoPoint(a.rx, a.ry);
      this.particles.pop(tp.x, tp.y, 14, tintFor(a.kind).a);
      this.shake = Math.min(12, this.shake + (a.kind === 'ogre' ? 10 : 3));
      this.anims.delete(id);
    }

    for (const d of this.deaths) d.t += dt;
    this.deaths = this.deaths.filter((d) => d.t < 0.6);

    // projectile impacts (a projectile present last frame but gone now)
    const liveProj = new Set(combat.projectiles.map((p) => p.id));
    for (const [id, last] of this.projLast) {
      if (!liveProj.has(id)) {
        const pr = this.project(last.x, last.y);
        this.particles.pop(
          pr.x,
          pr.y - this.unitPx * 0.55,
          8,
          last.team === 'ally' ? PROJECTILE.mageGlow : '#ffcaa8',
        );
        this.projLast.delete(id);
      }
    }
    for (const p of combat.projectiles) this.projLast.set(p.id, { x: p.x, y: p.y, team: p.team });

    this.particles.update(dt);

    if (combat.outcome !== this.prevOutcome) {
      if (combat.outcome === 'victory') this.flash = { r: 255, g: 255, b: 255, a: 0.5 };
      if (combat.outcome === 'defeat') this.flash = { r: 255, g: 40, b: 40, a: 0.55 };
      this.prevOutcome = combat.outcome;
    }
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, combat: CombatState): void {
    this.w = w;
    this.h = h;

    ctx.save();
    if (this.shake > 0.1) {
      ctx.translate(
        Math.round((Math.random() - 0.5) * this.shake),
        Math.round((Math.random() - 0.5) * this.shake),
      );
    }

    drawBackground(ctx, w, h, this.time);

    type Item =
      | { sortY: number; kind: 'unit'; unit: Unit; a: UnitAnim }
      | { sortY: number; kind: 'death'; d: DeathAnim };
    const items: Item[] = [];
    for (const u of combat.units) {
      const a = this.anims.get(u.id);
      if (a) items.push({ sortY: this.project(a.rx, a.ry).y, kind: 'unit', unit: u, a });
    }
    for (const d of this.deaths) items.push({ sortY: this.project(d.x, d.y).y, kind: 'death', d });
    items.sort((p, q) => p.sortY - q.sortY);

    for (const it of items) {
      if (it.kind === 'death') this.paintDeath(ctx, it.d);
      else this.paintUnit(ctx, it.unit, it.a);
    }

    this.paintProjectiles(ctx, combat.projectiles);
    this.particles.draw(ctx);

    for (const f of combat.floaters) {
      const pr = this.project(f.x, f.y);
      drawFloater(
        ctx,
        {
          x: pr.x,
          y: pr.y - this.unitPx * 1.1,
          text: f.text,
          kind: f.kind,
          ttl: f.ttl,
          maxTtl: 0.8,
        },
        this.unitPx * 0.5,
      );
    }

    this.paintBossBar(ctx, w, combat);

    ctx.restore();

    if (this.flash.a > 0.01) {
      ctx.fillStyle = `rgba(${this.flash.r},${this.flash.g},${this.flash.b},${this.flash.a})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private paintShadow(ctx: CanvasRenderingContext2D, x: number, y: number, ph: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const rx = Math.round(ph * 0.32);
    ctx.fillRect(Math.round(x) - rx, Math.round(y) - 1, rx * 2, 3);
  }

  private paintUnit(ctx: CanvasRenderingContext2D, u: Unit, a: UnitAnim) {
    const pr = this.project(a.rx, a.ry);
    const ph = this.unitPx * (KIND_SCALE[u.kind] ?? 1) * pr.scale * (0.6 + 0.4 * a.spawn);
    this.paintShadow(ctx, pr.x, pr.y, ph);

    ctx.save();
    ctx.translate(Math.round(pr.x), Math.round(pr.y - a.pose.hit * 3));
    ctx.globalAlpha = a.spawn;
    ctx.scale((a.facing * ph) / 100, ph / 100);
    drawSprite(ctx, u.kind, a.pose, tintFor(u.kind));
    ctx.restore();
    ctx.globalAlpha = 1;

    // hp bar (enemies always; allies only when hurt, to cut clutter)
    const ratio = u.hp / u.stats.maxHp;
    if (u.kind !== 'ogre' && (u.team === 'enemy' || ratio < 0.999)) {
      const bw = Math.max(24, ph * 0.9);
      drawHpBar(
        ctx,
        pr.x - bw / 2,
        pr.y - ph * 1.05,
        bw,
        Math.max(4, ph * 0.07),
        ratio,
        a.chip,
        TEAM[u.team].hp,
      );
    }
  }

  private paintDeath(ctx: CanvasRenderingContext2D, d: DeathAnim) {
    const pr = this.project(d.x, d.y);
    const ph = this.unitPx * (KIND_SCALE[d.kind] ?? 1) * pr.scale;
    const k = d.t / 0.6;
    this.paintShadow(ctx, pr.x, pr.y, ph * (1 - k * 0.5));
    ctx.save();
    ctx.translate(Math.round(pr.x), Math.round(pr.y));
    ctx.globalAlpha = 1 - k;
    ctx.rotate(d.facing * k * 1.3);
    ctx.scale((d.facing * ph) / 100, ph / 100);
    drawSprite(ctx, d.kind, { attack: 0, hit: 1 - k, step: 0, walking: false, bob: 0 }, d.tint);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private paintProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[]) {
    const u = this.unitPx;
    for (const p of projectiles) {
      const pr = this.project(p.x, p.y);
      const cy = pr.y - u * 0.55;
      if (p.team === 'enemy') {
        ctx.save();
        ctx.translate(pr.x, cy);
        ctx.rotate(Math.PI); // enemy arrows fly toward the party (left)
        ctx.strokeStyle = PROJECTILE.arrow;
        ctx.lineWidth = Math.max(1.5, u * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-u * 0.4, 0);
        ctx.lineTo(u * 0.25, 0);
        ctx.stroke();
        ctx.restore();
      } else {
        const rad = u * 0.28;
        const g = ctx.createRadialGradient(pr.x, cy, 0, pr.x, cy, rad * 2.4);
        g.addColorStop(0, PROJECTILE.mageCore);
        g.addColorStop(0.35, PROJECTILE.mageGlow);
        g.addColorStop(1, 'rgba(127,176,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pr.x, cy, rad * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private paintBossBar(ctx: CanvasRenderingContext2D, w: number, combat: CombatState) {
    const boss = combat.units.find((u) => u.team === 'enemy' && u.kind === 'ogre');
    if (!boss) return;
    const bw = Math.min(w * 0.7, 520);
    const ratio = boss.hp / boss.stats.maxHp;
    drawHpBar(ctx, (w - bw) / 2, 34, bw, 14, ratio, ratio, TEAM.enemy.hp);
  }
}
