/**
 * Procedural vector "chibi" sprites for the combat renderer. No image assets.
 *
 * Every drawer works in a local space where (0,0) is between the feet, +x is the
 * facing direction and +y is down. The caller sets up translate/scale/mirror.
 * `H` is the nominal sprite height in local units (we draw ~1.0H tall).
 */

const H = 100;

export interface SpritePose {
  /** 0..1, decays after an attack — drives the swing / cast. */
  attack: number;
  /** 0..1, decays after taking damage — drives the white flash + recoil. */
  hit: number;
  /** running phase accumulator (radians). */
  step: number;
  /** true while the unit is moving. */
  walking: boolean;
  /** idle breathing phase (radians). */
  bob: number;
}

type Ctx = CanvasRenderingContext2D;

function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function legs(ctx: Ctx, pose: SpritePose, color: string) {
  const sw = pose.walking ? Math.sin(pose.step) * 0.16 * H : Math.sin(pose.bob) * 0.02 * H;
  limb(ctx, -0.06 * H, -0.16 * H, -0.06 * H - sw, 0, 0.09 * H, color);
  limb(ctx, 0.06 * H, -0.16 * H, 0.06 * H + sw, 0, 0.09 * H, color);
}

/** White silhouette-ish flash over the torso when recently hit. */
function hitFlash(ctx: Ctx, pose: SpritePose) {
  if (pose.hit <= 0) return;
  ctx.globalAlpha = Math.min(0.75, pose.hit * 0.75);
  ellipse(ctx, 0, -0.4 * H, 0.22 * H, 0.34 * H, '#ffffff');
  ctx.globalAlpha = 1;
}

function bodyLift(pose: SpritePose): number {
  const idle = Math.sin(pose.bob) * 0.015 * H;
  const walk = pose.walking ? Math.abs(Math.sin(pose.step)) * 0.03 * H : 0;
  return idle - walk;
}

// --- allies ---------------------------------------------------------------

function drawWarrior(ctx: Ctx, pose: SpritePose, c: { a: string; b: string; c: string }) {
  const lift = bodyLift(pose);
  const swing = Math.sin(pose.attack * Math.PI);
  ctx.translate(swing * 0.1 * H, 0);

  legs(ctx, pose, c.b);

  // torso (armoured trapezoid)
  ctx.fillStyle = c.a;
  ctx.beginPath();
  ctx.moveTo(-0.16 * H, -0.16 * H + lift);
  ctx.lineTo(0.16 * H, -0.16 * H + lift);
  ctx.lineTo(0.2 * H, -0.5 * H + lift);
  ctx.lineTo(-0.2 * H, -0.5 * H + lift);
  ctx.closePath();
  ctx.fill();
  limb(ctx, -0.12 * H, -0.48 * H + lift, 0.12 * H, -0.48 * H + lift, 0.1 * H, c.b); // shoulder line

  // shield arm (back)
  ellipse(ctx, -0.16 * H, -0.34 * H + lift, 0.12 * H, 0.16 * H, c.b);
  ellipse(ctx, -0.16 * H, -0.34 * H + lift, 0.07 * H, 0.1 * H, c.c);

  // head + helm
  ellipse(ctx, 0, -0.62 * H + lift, 0.13 * H, 0.14 * H, '#e8c8a0');
  ctx.fillStyle = c.a;
  ctx.beginPath();
  ctx.arc(0, -0.64 * H + lift, 0.15 * H, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-0.15 * H, -0.66 * H + lift, 0.3 * H, 0.05 * H);
  ctx.fillStyle = c.c; // helm crest
  ctx.fillRect(-0.02 * H, -0.82 * H + lift, 0.04 * H, 0.16 * H);

  // sword arm (front) — swings on attack
  const ang = -0.5 - swing * 1.7;
  ctx.save();
  ctx.translate(0.14 * H, -0.42 * H + lift);
  ctx.rotate(ang);
  limb(ctx, 0, 0, 0.16 * H, 0, 0.08 * H, '#e8c8a0'); // arm
  limb(ctx, 0.12 * H, 0, 0.5 * H, 0, 0.06 * H, '#dfe7ef'); // blade
  limb(ctx, 0.1 * H, -0.05 * H, 0.1 * H, 0.05 * H, 0.03 * H, c.c); // crossguard
  ctx.restore();

  hitFlash(ctx, pose);
}

function drawMage(ctx: Ctx, pose: SpritePose, c: { a: string; b: string; c: string }) {
  const lift = bodyLift(pose);
  const cast = Math.sin(pose.attack * Math.PI);

  legs(ctx, pose, c.b);

  // robe
  ctx.fillStyle = c.a;
  ctx.beginPath();
  ctx.moveTo(0, -0.55 * H + lift);
  ctx.lineTo(0.22 * H, -0.02 * H);
  ctx.lineTo(-0.22 * H, -0.02 * H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.b;
  ctx.beginPath();
  ctx.moveTo(0, -0.55 * H + lift);
  ctx.lineTo(0.07 * H, -0.02 * H);
  ctx.lineTo(-0.07 * H, -0.02 * H);
  ctx.closePath();
  ctx.fill();

  // head + wide-brim hat
  ellipse(ctx, 0, -0.6 * H + lift, 0.12 * H, 0.13 * H, '#e8c8a0');
  ctx.fillStyle = c.b;
  ellipse(ctx, 0, -0.66 * H + lift, 0.24 * H, 0.05 * H, c.b);
  ctx.beginPath();
  ctx.moveTo(-0.12 * H, -0.66 * H + lift);
  ctx.lineTo(0.12 * H, -0.66 * H + lift);
  ctx.lineTo(0.02 * H, -0.95 * H + lift);
  ctx.closePath();
  ctx.fill();

  // staff + orb (front hand), orb flares on cast
  const sx = 0.16 * H;
  const sy = -0.4 * H + lift - cast * 0.05 * H;
  limb(ctx, 0.04 * H, -0.4 * H + lift, sx, -0.04 * H, 0.06 * H, '#e8c8a0'); // arm
  limb(ctx, sx, sy + 0.05 * H, sx, sy - 0.34 * H, 0.04 * H, '#6b4a2a'); // shaft
  const orbR = 0.09 * H * (1 + cast * 0.7);
  const g = ctx.createRadialGradient(sx, sy - 0.36 * H, 0, sx, sy - 0.36 * H, orbR * 2.2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, c.c);
  g.addColorStop(1, 'rgba(255,224,138,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy - 0.36 * H, orbR * 2.2, 0, Math.PI * 2);
  ctx.fill();

  hitFlash(ctx, pose);
}

// --- enemies ------------------------------------------------------------

function drawGoblinoid(
  ctx: Ctx,
  pose: SpritePose,
  c: { a: string; b: string; c: string },
  variant: 'goblin' | 'archer',
) {
  const lift = bodyLift(pose);
  const swing = Math.sin(pose.attack * Math.PI);

  legs(ctx, pose, c.b);

  // hunched body
  ellipse(ctx, 0, -0.28 * H + lift, 0.17 * H, 0.2 * H, c.a);
  ellipse(ctx, 0, -0.14 * H, 0.14 * H, 0.08 * H, c.b); // loincloth

  // head with big ears + brow
  ellipse(ctx, 0.03 * H, -0.5 * H + lift, 0.13 * H, 0.12 * H, c.a);
  ctx.fillStyle = c.a;
  ctx.beginPath();
  ctx.moveTo(-0.08 * H, -0.5 * H + lift);
  ctx.lineTo(-0.26 * H, -0.56 * H + lift);
  ctx.lineTo(-0.09 * H, -0.44 * H + lift);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.12 * H, -0.5 * H + lift);
  ctx.lineTo(0.3 * H, -0.56 * H + lift);
  ctx.lineTo(0.13 * H, -0.44 * H + lift);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 0.08 * H, -0.52 * H + lift, 0.03 * H, 0.02 * H, '#ffd23d'); // eye

  if (variant === 'goblin') {
    const ang = -0.3 - swing * 1.8;
    ctx.save();
    ctx.translate(0.1 * H, -0.32 * H + lift);
    ctx.rotate(ang);
    limb(ctx, 0, 0, 0.14 * H, 0, 0.06 * H, c.a);
    limb(ctx, 0.1 * H, 0, 0.34 * H, 0, 0.08 * H, c.c); // club
    ellipse(ctx, 0.34 * H, 0, 0.07 * H, 0.09 * H, c.c);
    ctx.restore();
  } else {
    // bow: string pulls back as attack rises
    const pull = swing * 0.12 * H;
    ctx.save();
    ctx.translate(0.14 * H, -0.32 * H + lift);
    ctx.strokeStyle = c.c;
    ctx.lineWidth = 0.04 * H;
    ctx.beginPath();
    ctx.arc(0, 0, 0.2 * H, -1.1, 1.1);
    ctx.stroke();
    limb(ctx, 0, -0.18 * H, -pull, 0, 0.02 * H, '#eee');
    limb(ctx, 0, 0.18 * H, -pull, 0, 0.02 * H, '#eee');
    limb(ctx, -pull, 0, 0.18 * H - pull, 0, 0.03 * H, '#d8c9a0'); // arrow
    ctx.restore();
  }

  hitFlash(ctx, pose);
}

function drawBrute(
  ctx: Ctx,
  pose: SpritePose,
  c: { a: string; b: string; c: string },
  big: boolean,
) {
  const lift = bodyLift(pose);
  const swing = Math.sin(pose.attack * Math.PI);
  const s = big ? 1.5 : 1;

  legs(ctx, pose, c.b);

  // bulky torso
  ellipse(ctx, 0, -0.32 * H * s + lift, 0.26 * H * s, 0.26 * H * s, c.a);
  if (big) ellipse(ctx, 0, -0.2 * H * s + lift, 0.22 * H * s, 0.18 * H * s, c.b); // belly

  // small head + tusks
  ellipse(ctx, 0.04 * H, -0.58 * H * s + lift, 0.12 * H * s, 0.11 * H * s, c.a);
  ctx.fillStyle = '#f2eede';
  ctx.beginPath();
  ctx.moveTo(-0.02 * H, -0.52 * H * s + lift);
  ctx.lineTo(-0.05 * H, -0.44 * H * s + lift);
  ctx.lineTo(0.01 * H, -0.5 * H * s + lift);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.1 * H, -0.52 * H * s + lift);
  ctx.lineTo(0.13 * H, -0.44 * H * s + lift);
  ctx.lineTo(0.07 * H, -0.5 * H * s + lift);
  ctx.closePath();
  ctx.fill();

  // weapon arm (axe / club) — heavy overhead swing
  const ang = -1.4 - swing * 1.6;
  ctx.save();
  ctx.translate(0.16 * H * s, -0.4 * H * s + lift);
  ctx.rotate(ang);
  limb(ctx, 0, 0, 0.2 * H * s, 0, 0.1 * H * s, c.a);
  limb(ctx, 0.14 * H * s, 0, 0.44 * H * s, 0, 0.05 * H * s, '#6b4a2a');
  if (big) {
    ellipse(ctx, 0.4 * H * s, 0, 0.12 * H * s, 0.16 * H * s, c.c);
  } else {
    ctx.fillStyle = c.c;
    ctx.beginPath();
    ctx.moveTo(0.34 * H * s, -0.14 * H * s);
    ctx.lineTo(0.5 * H * s, 0);
    ctx.lineTo(0.34 * H * s, 0.14 * H * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  hitFlash(ctx, pose);
}

// --- dispatch ----------------------------------------------------------

const DRAWERS: Record<
  string,
  (ctx: Ctx, pose: SpritePose, c: { a: string; b: string; c: string }) => void
> = {
  warrior: drawWarrior,
  mage: drawMage,
  priest: drawMage,
  rogue: (ctx, p, c) => drawGoblinoid(ctx, p, c, 'goblin'),
  goblin: (ctx, p, c) => drawGoblinoid(ctx, p, c, 'goblin'),
  archer: (ctx, p, c) => drawGoblinoid(ctx, p, c, 'archer'),
  orc: (ctx, p, c) => drawBrute(ctx, p, c, false),
  ogre: (ctx, p, c) => drawBrute(ctx, p, c, true),
};

export function drawSprite(
  ctx: Ctx,
  kind: string,
  pose: SpritePose,
  tint: { a: string; b: string; c: string },
): void {
  (DRAWERS[kind] ?? DRAWERS.goblin)(ctx, pose, tint);
}

/** Local sprite height in the units the drawers use (for scale maths). */
export const SPRITE_LOCAL_HEIGHT = H;
