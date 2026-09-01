/** Particle system + combat-text + hp-bar drawing for the 2D renderer. */

import { TEXT } from './palette';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export class Particles {
  private items: Particle[] = [];
  private readonly cap = 320;

  get count(): number {
    return this.items.length;
  }

  spawn(p: Particle): void {
    if (this.items.length >= this.cap) this.items.shift();
    this.items.push(p);
  }

  /** A directional shower of sparks (hits). */
  burst(x: number, y: number, dir: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 1.6;
      const sp = 60 + Math.random() * 180;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 1.5 + Math.random() * 2.5,
        color,
        gravity: 420,
      });
    }
  }

  /** A radial pop (deaths / impacts). */
  pop(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 80 + Math.random() * 160;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 2 + Math.random() * 3,
        color,
        gravity: 200,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.items = this.items.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Rounded horizontal bar with a lagging "chip" layer. */
export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  chipRatio: number,
  fill: string,
): void {
  const r = h / 2;
  const rr = (rw: number) => {
    const width = Math.max(0, rw);
    if (width <= 0) return;
    ctx.beginPath();
    ctx.roundRect(x, y, width, h, Math.min(r, width / 2));
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(w);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; // lagging chip-damage layer
  rr(w * Math.max(ratio, Math.min(chipRatio, 1)));
  ctx.fillStyle = fill;
  rr(w * Math.max(0, Math.min(ratio, 1)));
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

export interface FloaterView {
  x: number;
  y: number;
  text: string;
  kind: 'damage' | 'crit' | 'heal';
  ttl: number;
  maxTtl: number;
}

export function drawFloater(ctx: CanvasRenderingContext2D, f: FloaterView, unit: number): void {
  const age = 1 - f.ttl / f.maxTtl;
  const pop = f.kind === 'crit' ? 1.3 : 1;
  const scale = pop * (age < 0.15 ? age / 0.15 : 1);
  const size = unit * (f.kind === 'crit' ? 2.4 : 1.7) * scale;
  ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl / f.maxTtl) * 1.4);
  ctx.font = `700 ${Math.round(size)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.strokeStyle = TEXT.outline;
  ctx.strokeText(f.text, f.x, f.y);
  ctx.fillStyle = f.kind === 'crit' ? TEXT.crit : f.kind === 'heal' ? TEXT.heal : TEXT.damage;
  ctx.fillText(f.text, f.x, f.y);
  ctx.globalAlpha = 1;
}
