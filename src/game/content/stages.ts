/**
 * Stages are generated procedurally from the stage number rather than hand-authored,
 * so progression is effectively endless. Every 10th stage ends on a boss wave.
 *
 * Enemy variety is gated by stage so the opening is a gentle ramp (pure goblins),
 * with archers and orcs mixing in later.
 */

export interface WaveDef {
  /** Enemy template ids that make up this wave. */
  enemies: string[];
  isBoss: boolean;
}

export interface StageDef {
  stage: number;
  waves: WaveDef[];
  /** Base rewards for clearing the whole stage, before per-stage scaling. */
  baseGold: number;
  baseXp: number;
}

export function isBossStage(stage: number): boolean {
  return stage % 10 === 0;
}

/** Deterministic enemy pick for one slot in a wave. */
function enemyForSlot(stage: number, wave: number, index: number): string {
  const roll = (stage * 7 + wave * 3 + index) % 10;
  if (stage < 4) return 'goblin';
  if (stage < 8) return roll < 7 ? 'goblin' : 'archer';
  if (stage < 15) return roll < 5 ? 'goblin' : roll < 8 ? 'archer' : 'orc';
  return roll < 3 ? 'goblin' : roll < 6 ? 'archer' : 'orc';
}

export function getStage(stage: number): StageDef {
  const s = Math.max(1, Math.floor(stage));
  const boss = isBossStage(s);
  const waveCount = boss ? 3 : 2 + (s % 3 === 0 ? 1 : 0); // 2..3, boss stages 3

  const waves: WaveDef[] = [];
  for (let w = 0; w < waveCount; w++) {
    const last = w === waveCount - 1;
    if (boss && last) {
      waves.push({ enemies: ['ogre'], isBoss: true });
      continue;
    }
    const size = 2 + Math.floor(s / 9) + w; // grows slowly with stage and wave
    const enemies: string[] = [];
    for (let i = 0; i < size; i++) enemies.push(enemyForSlot(s, w, i));
    waves.push({ enemies, isBoss: false });
  }

  return {
    stage: s,
    waves,
    baseGold: 18 + s * 6,
    baseXp: 22 + s * 8,
  };
}
