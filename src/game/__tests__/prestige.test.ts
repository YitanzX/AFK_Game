import { describe, it, expect } from 'vitest';
import { relicGain, prestigeRunStart, RELIC_BY_ID } from '../content/prestige';

describe('relicGain', () => {
  it('is monotonic and zero at the very start', () => {
    expect(relicGain(0)).toBe(0);
    expect(relicGain(8)).toBe(1);
    for (let s = 10; s < 200; s += 10) {
      expect(relicGain(s + 10)).toBeGreaterThanOrEqual(relicGain(s));
    }
    expect(relicGain(52)).toBeGreaterThan(relicGain(20));
  });
});

describe('prestigeRunStart', () => {
  it('defaults to stage 1, level 1, gear wiped', () => {
    expect(prestigeRunStart({})).toEqual({ stage: 1, level: 1, keepGear: false });
  });

  it('relic_start pushes the starting stage', () => {
    expect(prestigeRunStart({ relic_start: 3 }).stage).toBe(1 + 15);
  });

  it('relic_headstart raises the starting level', () => {
    expect(prestigeRunStart({ relic_headstart: 4 }).level).toBe(1 + 12);
  });

  it('relic_keepgear keeps equipment', () => {
    expect(prestigeRunStart({ relic_keepgear: 1 }).keepGear).toBe(true);
  });
});

describe('relic upgrade content', () => {
  it('run-effect upgrades have no meta effects and vice versa', () => {
    for (const up of Object.values(RELIC_BY_ID)) {
      const hasMeta = !!up.metaEffects?.length;
      const hasRun = !!up.runEffect;
      expect(hasMeta || hasRun).toBe(true);
      expect(hasMeta && hasRun).toBe(false);
    }
  });
});
