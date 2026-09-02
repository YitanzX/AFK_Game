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
  private readonly cap = 120;

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
      const a = dir + (Math.random() - 0.5) * 1.4;
      const sp = 50 + Math.random() * 120;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0.22 + Math.random() * 0.2,
        maxLife: 0.42,
        size: 2 + Math.random() * 2,
        color,
        gravity: 380,
      });
    }
  }

  /** A radial pop (deaths / impacts). */
  pop(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 60 + Math.random() * 110;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.25,
        maxLife: 0.55,
        size: 2 + Math.random() * 2.5,
        color,
        gravity: 180,
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
      const s = Math.max(1, Math.round(p.size));
      ctx.fillRect(Math.round(p.x) - (s >> 1), Math.round(p.y) - (s >> 1), s, s);
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
  const px = Math.round(x);
  const py = Math.round(y);
  const pw = Math.round(w);
  const ph = Math.max(3, Math.round(h));
  // black pixel frame
  ctx.fillStyle = '#0c0a14';
  ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(px, py, pw, ph);
  // lagging chip-damage layer
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(px, py, Math.round(pw * Math.max(ratio, Math.min(chipRatio, 1))), ph);
  // fill + a lighter top pixel row
  const fw = Math.round(pw * Math.max(0, Math.min(ratio, 1)));
  ctx.fillStyle = fill;
  ctx.fillRect(px, py, fw, ph);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(px, py, fw, 1);
}

export interface FloaterView {
  x: number;
  y: number;
  text: string;
  kind: 'damage' | 'crit' | 'heal';
  ttl: number;
  maxTtl: number;
}

const PIXEL_FONT = '"Press Start 2P", "VT323", monospace';

export function drawFloater(ctx: CanvasRenderingContext2D, f: FloaterView, unit: number): void {
  const age = 1 - f.ttl / f.maxTtl;
  const pop = f.kind === 'crit' ? 1.25 : 1;
  const scale = pop * (age < 0.15 ? age / 0.15 : 1);
  const size = Math.max(5, Math.round(unit * (f.kind === 'crit' ? 0.9 : 0.65) * scale));
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  ctx.globalAlpha = Math.max(0, Math.min(1, (f.ttl / f.maxTtl) * 1.4));
  ctx.font = `${size}px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 1px pixel outline via 4 offset draws
  ctx.fillStyle = '#0c0a14';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    ctx.fillText(f.text, x + dx, y + dy);
  }
  ctx.fillStyle = f.kind === 'crit' ? TEXT.crit : f.kind === 'heal' ? TEXT.heal : TEXT.damage;
  ctx.fillText(f.text, x, y);
  ctx.globalAlpha = 1;
}
