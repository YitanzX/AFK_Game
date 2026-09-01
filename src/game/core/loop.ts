/**
 * Fixed-timestep game loop, decoupled from React.
 *
 * The simulation always advances in TICK_SECONDS increments regardless of frame
 * rate. Real elapsed time is accumulated; if the tab was backgrounded we clamp
 * the catch-up to MAX_STEPS so we never freeze trying to simulate minutes of
 * skipped frames in one go (idle/offline gains are handled separately in afk.ts).
 */

export const TICK_SECONDS = 0.05; // 20 ticks / second
const MAX_STEPS_PER_FRAME = 5;

export interface GameLoopOptions {
  /** Called once per fixed tick with a constant dt of TICK_SECONDS. */
  onTick: (dt: number) => void;
  /** Optional: called once per rendered frame after ticking. */
  onFrame?: () => void;
  /** Simulation speed multiplier (1 = real time). */
  speed?: number;
}

export class GameLoop {
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly onTick: (dt: number) => void;
  private readonly onFrame?: () => void;
  private speed: number;

  constructor(opts: GameLoopOptions) {
    this.onTick = opts.onTick;
    this.onFrame = opts.onFrame;
    this.speed = opts.speed ?? 1;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0, speed);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private frame = (now: number): void => {
    if (!this.running) return;

    let delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // A single hitch (alt-tab, breakpoint) shouldn't dump a huge delta in.
    if (delta > 0.25) delta = 0.25;

    this.accumulator += delta * this.speed;

    let steps = 0;
    while (this.accumulator >= TICK_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.onTick(TICK_SECONDS);
      this.accumulator -= TICK_SECONDS;
      steps++;
    }
    // Drop leftover backlog beyond what we're willing to catch up on.
    if (this.accumulator > TICK_SECONDS * MAX_STEPS_PER_FRAME) {
      this.accumulator = 0;
    }

    this.onFrame?.();
    this.rafId = requestAnimationFrame(this.frame);
  };
}
