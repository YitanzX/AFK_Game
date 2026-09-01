/** Layered parallax battlefield backdrop, drawn straight to the canvas. */

import {
  SKY,
  HILLS_FAR,
  HILLS_NEAR,
  GROUND,
  GROUND_TOP,
  GROUND_DARK,
  GROUND_TUFT,
} from './palette';

/** Fraction of canvas height where the ground plane starts. */
export const HORIZON = 0.72;

function hillPath(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  step: number,
  phase: number,
) {
  ctx.beginPath();
  ctx.moveTo(0, baseY + amp);
  for (let x = 0; x <= w; x += step) {
    const y = baseY - Math.sin(x / step + phase) * amp - Math.sin(x / (step * 2.7) + phase) * amp * 0.4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, baseY + amp + 400);
  ctx.lineTo(0, baseY + amp + 400);
  ctx.closePath();
  ctx.fill();
}

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const groundY = h * HORIZON;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, SKY.top);
  sky.addColorStop(0.55, SKY.mid);
  sky.addColorStop(0.85, SKY.low);
  sky.addColorStop(1, SKY.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, groundY + 2);

  // sun glow low on the horizon
  const sunX = w * 0.5;
  const glow = ctx.createRadialGradient(sunX, groundY, 0, sunX, groundY, h * 0.5);
  glow.addColorStop(0, 'rgba(255,210,150,0.55)');
  glow.addColorStop(0.4, 'rgba(255,170,110,0.18)');
  glow.addColorStop(1, 'rgba(255,170,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, groundY + 2);

  // parallax hills (very slow drift)
  ctx.fillStyle = HILLS_FAR;
  hillPath(ctx, w, groundY - h * 0.02, h * 0.06, w * 0.14, time * 0.02);
  ctx.fillStyle = HILLS_NEAR;
  hillPath(ctx, w, groundY + h * 0.01, h * 0.09, w * 0.1, time * 0.035 + 2);

  // ground plane
  const gnd = ctx.createLinearGradient(0, groundY, 0, h);
  gnd.addColorStop(0, GROUND_TOP);
  gnd.addColorStop(0.12, GROUND);
  gnd.addColorStop(1, GROUND_DARK);
  ctx.fillStyle = gnd;
  ctx.fillRect(0, groundY, w, h - groundY);

  // grass tufts along the front, deterministic positions
  ctx.strokeStyle = GROUND_TUFT;
  ctx.lineWidth = Math.max(1, h * 0.004);
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const gx = ((i * 97.13) % 1) * w + ((i * 53.7) % w);
    const x = gx % w;
    const y = groundY + ((i * 29) % (h - groundY)) * 0.9 + 6;
    const sway = Math.sin(time * 1.5 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway, y - 6 - (i % 3) * 2);
    ctx.stroke();
  }

  // vignette
  const vig = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.2, w / 2, h * 0.55, h * 0.8);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}
