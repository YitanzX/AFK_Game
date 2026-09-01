import { describe, it, expect } from 'vitest';
import { createCombat, stepCombat } from '../core/simulation';
import { mulberry32, hashSeed } from '../core/rng';
import { TICK_SECONDS } from '../core/loop';
import { getStage } from '../content/stages';
import type { CombatState, RosterUnit } from '../core/types';

const ROSTER: RosterUnit[] = [
  { classId: 'warrior', level: 1, xp: 0 },
  { classId: 'mage', level: 1, xp: 0 },
];

function runToEnd(seed: number, stage: number, attempt: number) {
  const rng = mulberry32(hashSeed(seed, stage, attempt));
  const state = createCombat({ roster: ROSTER, stage, attempt });
  let ticks = 0;
  const MAX_TICKS = 60 * 60 * 5; // 5 simulated minutes safety cap
  while (state.outcome === 'ongoing' && ticks < MAX_TICKS) {
    stepCombat(state, TICK_SECONDS, rng);
    ticks++;
  }
  return { state, ticks };
}

function fingerprint(state: CombatState): string {
  return JSON.stringify({
    outcome: state.outcome,
    wave: state.wave,
    units: state.units.map((u) => [u.id, Math.round(u.hp), Math.round(u.x), Math.round(u.y)]),
  });
}

describe('stepCombat', () => {
  it('reaches a terminal outcome for an early stage', () => {
    const { state } = runToEnd(1234, 1, 1);
    expect(['victory', 'defeat']).toContain(state.outcome);
  });

  it('is fully deterministic for the same seed/stage/attempt', () => {
    const a = runToEnd(999, 3, 2);
    const b = runToEnd(999, 3, 2);
    expect(a.ticks).toBe(b.ticks);
    expect(fingerprint(a.state)).toBe(fingerprint(b.state));
  });

  it('a different attempt changes the outcome trace', () => {
    const a = runToEnd(999, 3, 1);
    const b = runToEnd(999, 3, 2);
    // Not a hard guarantee of different outcome, but the trace must differ.
    expect(fingerprint(a.state) === fingerprint(b.state) && a.ticks === b.ticks).toBe(false);
  });

  it('early stages are winnable by the starter party', () => {
    const { state } = runToEnd(2, 1, 1);
    expect(state.outcome).toBe('victory');
  });

  it('spawns both allies and the first wave of enemies', () => {
    const state = createCombat({ roster: ROSTER, stage: 1, attempt: 1 });
    expect(state.units.filter((u) => u.team === 'ally')).toHaveLength(2);
    expect(state.units.some((u) => u.team === 'enemy')).toBe(true);
    expect(state.wave).toBe(1);
  });

  it('accrues gold/xp/kills only as enemies die', () => {
    const { state } = runToEnd(2, 1, 1); // starter party clears stage 1
    expect(state.outcome).toBe('victory');
    expect(state.rewards.gold).toBeGreaterThan(0);
    expect(state.rewards.xp).toBeGreaterThan(0);
    // a clear means every spawned enemy died -> one kill each
    const spawned = getStage(1).waves.reduce((n, w) => n + w.enemies.length, 0);
    expect(state.kills).toBe(spawned);
  });

  it('rewards start at zero', () => {
    const state = createCombat({ roster: ROSTER, stage: 3, attempt: 1 });
    expect(state.rewards).toEqual({ gold: 0, xp: 0 });
    expect(state.kills).toBe(0);
  });
});
