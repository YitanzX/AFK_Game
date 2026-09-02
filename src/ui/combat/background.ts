/** Flat-shaded, dithered pixel-art battlefield backdrop. */

export const HORIZON = 0.72;

const SKY_BANDS = ['#1e1830', '#342444', '#4c2f52', '#7a3f52', '#b3623f', '#e39a55'];
const SUN = '#ffd9a0';
const HILLS_FAR = '#3b2c4f';
const HILLS_NEAR = '#2a2040';
const GRASS = '#43703c';
const GRASS_DK = '#2f5230';
const DIRT = '#2a2018';
const DIRT_DK = '#1a130e';
const TUFT = '#5c8c4a';

function ditherRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  w: number,
  a: string,
  b: string,
  cell = 2,
) {
  for (let x = 0; x < w; x += cell) {
    ctx.fillStyle = ((x / cell) & 1) === 0 ? a : b;
    ctx.fillRect(x, y, cell, cell);
  }
}

/** Blocky stepped hill silhouette. */
function hills(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  wavelength: number,
  phase: number,
  color: string,
  step = 3,
) {
  ctx.fillStyle = color;
  for (let x = 0; x < w; x += step) {
    const raw =
      baseY -
      Math.sin(x / wavelength + phase) * amp -
      Math.sin(x / (wavelength * 2.7) + phase) * amp * 0.4;
    const y = Math.round(raw / step) * step;
    ctx.fillRect(x, y, step + 1, baseY + amp + 60 - y);
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const groundY = Math.round(h * HORIZON);

  // sky: flat colour bands with a dithered seam between each
  const bandH = groundY / SKY_BANDS.length;
  for (let i = 0; i < SKY_BANDS.length; i++) {
    const y0 = Math.round(i * bandH);
    const y1 = Math.round((i + 1) * bandH);
    ctx.fillStyle = SKY_BANDS[i];
    ctx.fillRect(0, y0, w, y1 - y0);
    if (i > 0) {
      ditherRow(ctx, y0 - 1, w, SKY_BANDS[i - 1], SKY_BANDS[i], 3);
      ditherRow(ctx, y0 + 1, w, SKY_BANDS[i], SKY_BANDS[i - 1], 3);
    }
  }

  // sun disc low on the horizon
  const sr = Math.round(h * 0.09);
  const sx = Math.round(w * 0.5);
  const sy = groundY - Math.round(sr * 0.3);
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  // parallax hills (very slow drift)
  hills(ctx, w, groundY - Math.round(h * 0.015), Math.round(h * 0.05), w * 0.16, time * 0.02, HILLS_FAR);
  hills(ctx, w, groundY + Math.round(h * 0.01), Math.round(h * 0.08), w * 0.12, time * 0.035 + 2, HILLS_NEAR);

  // ground: grass strip, dither, dirt, darker floor
  const grassH = Math.round(h * 0.05);
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, groundY, w, grassH);
  ditherRow(ctx, groundY + grassH, w, GRASS, GRASS_DK, 3);
  ctx.fillStyle = DIRT;
  ctx.fillRect(0, groundY + grassH + 3, w, h);
  ctx.fillStyle = DIRT_DK;
  ctx.fillRect(0, Math.round(h * 0.9), w, h);

  // deterministic grass tufts along the front edge
  ctx.fillStyle = TUFT;
  for (let i = 0; i < 40; i++) {
    const x = Math.round(((i * 61.7) % 1000) / 1000 * w);
    const sway = Math.sin(time * 2 + i) > 0 ? 1 : 0;
    ctx.fillRect(x + sway, groundY - 3, 2, 4);
    ctx.fillRect(x - 1 + sway, groundY - 1, 2, 2);
  }

  // corner vignette in flat steps
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, w, Math.round(h * 0.06));
  ctx.fillRect(0, Math.round(h * 0.94), w, h);
}
