/**
 * Glue between the fixed-timestep loop, the pure simulation and the store.
 *
 * A single instance owns the current CombatState and steps it. When a battle
 * ends it reports the outcome to the store (rewards, stage advance/retry),
 * waits a beat so the player can read the result, then starts the next battle
 * with fresh roster stats and a new deterministic seed.
 *
 * The canvas renderer reads `getCombat()` every draw frame; it never mutates it.
 */

import { GameLoop } from '../core/loop';
import { createCombat, stepCombat } from '../core/simulation';
import { mulberry32, hashSeed, type Rng } from '../core/rng';
import type { CombatState } from '../core/types';
import { useGameStore } from './store';

const RESULT_PAUSE_MS = 900;

/** Live hp per party slot, including the KO flag once a hero has fallen. */
export interface PartySlotHp {
  hp: number;
  maxHp: number;
  alive: boolean;
}

class BattleController {
  private loop: GameLoop;
  private combat: CombatState;
  private rng: Rng = mulberry32(1);
  /** Rewards already pushed to the store for the current combat. */
  private banked = { gold: 0, xp: 0, kills: 0 };
  private endHandled = false;
  private pauseUntil = 0;
  /**
   * Per-roster-index hp for the party panel. The sim deletes dead units, so we
   * remember which slots existed this battle and report hp 0 / alive:false for
   * any that have since vanished (rather than letting the panel fall back to
   * full hp).
   */
  private partyHp: Record<number, PartySlotHp> = {};

  constructor() {
    this.combat = this.buildCombat();
    this.loop = new GameLoop({ onTick: this.tick });
  }

  getCombat(): CombatState {
    return this.combat;
  }

  getPartyHp(): Record<number, PartySlotHp> {
    return this.partyHp;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  setSpeed(multiplier: number): void {
    this.loop.setSpeed(multiplier);
  }

  /** Rebuild the current battle from live store state (roster, stage, attempt). */
  restart(): void {
    this.combat = this.buildCombat();
  }

  private buildCombat(): CombatState {
    const s = useGameStore.getState();
    this.rng = mulberry32(hashSeed(s.seed, s.farmingStage, s.stageAttempt));
    this.banked = { gold: 0, xp: 0, kills: 0 };
    this.endHandled = false;
    this.pauseUntil = 0;
    const combat = createCombat({
      roster: s.roster,
      stage: s.farmingStage,
      attempt: s.stageAttempt,
    });
    this.partyHp = {};
    for (const u of combat.units) {
      if (u.team === 'ally' && u.rosterIndex >= 0) {
        this.partyHp[u.rosterIndex] = { hp: u.hp, maxHp: u.stats.maxHp, alive: true };
      }
    }
    return combat;
  }

  /** Sync party-panel hp from the live units; vanished allies are marked KO. */
  private syncPartyHp(): void {
    const present = new Set<number>();
    for (const u of this.combat.units) {
      if (u.team !== 'ally' || u.rosterIndex < 0) continue;
      present.add(u.rosterIndex);
      this.partyHp[u.rosterIndex] = { hp: u.hp, maxHp: u.stats.maxHp, alive: true };
    }
    for (const key of Object.keys(this.partyHp)) {
      const idx = Number(key);
      if (!present.has(idx)) {
        this.partyHp[idx].hp = 0;
        this.partyHp[idx].alive = false;
      }
    }
  }

  /** Push newly-earned kill rewards (the delta since last tick) to the store. */
  private flushRewards(): void {
    const r = this.combat.rewards;
    const dGold = r.gold - this.banked.gold;
    const dXp = r.xp - this.banked.xp;
    const dKills = this.combat.kills - this.banked.kills;
    if (dGold > 0 || dXp > 0 || dKills > 0) {
      useGameStore.getState().addKillRewards(dGold, dXp, dKills);
      this.banked = { gold: r.gold, xp: r.xp, kills: this.combat.kills };
    }
  }

  private tick = (dt: number): void => {
    if (this.combat.outcome === 'ongoing') {
      stepCombat(this.combat, dt, this.rng);
      this.flushRewards();
      this.syncPartyHp();
      return;
    }

    if (!this.endHandled) {
      this.endHandled = true;
      this.flushRewards(); // catch the killing blow
      this.syncPartyHp();
      useGameStore.getState().reportBattleEnd(this.combat.outcome);
      this.pauseUntil = performance.now() + RESULT_PAUSE_MS;
      return;
    }

    if (performance.now() >= this.pauseUntil) {
      this.restart();
    }
  };
}

export const battleController = new BattleController();
