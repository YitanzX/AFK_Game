import { describe, it, expect } from 'vitest';
import {
  SKILLS,
  skillsForClass,
  skillPointsForLevel,
  spentPoints,
  availablePoints,
} from '../content/skills';
import { resolveSkills, passiveStatMods } from '../systems/skills';
import { deriveUnitStats } from '../systems/stats';
import { statsForLevel } from '../content/classes';
import { createCombat, stepCombat } from '../core/simulation';
import { mulberry32, hashSeed } from '../core/rng';
import { TICK_SECONDS } from '../core/loop';
import { hero } from './_fixtures';
import { resolveParty } from '../state/store';
import type { PartySlot } from '../core/types';

describe('skill points maths', () => {
  it('grants one point per level', () => {
    expect(skillPointsForLevel(1)).toBe(0);
    expect(skillPointsForLevel(10)).toBe(9);
  });

  it('spentPoints counts rank * costPerRank', () => {
    // mage_meteor costs 2 per rank
    expect(spentPoints({ mage_firebolt: 3, mage_meteor: 2 })).toBe(3 * 1 + 2 * 2);
  });

  it('availablePoints = earned - spent', () => {
    const h = hero('mage', 20);
    h.skills = { mage_firebolt: 2 };
    expect(availablePoints(h)).toBe(skillPointsForLevel(20) - 2);
  });
});

describe('resolveSkills', () => {
  it('returns only purchased skills, actives before passives-by-priority', () => {
    const h = hero('warrior', 10);
    h.skills = { warrior_cleave: 2, warrior_ironskin: 1 };
    const r = resolveSkills(h);
    expect(r.map((s) => s.id).sort()).toEqual(['warrior_cleave', 'warrior_ironskin']);
    expect(r.find((s) => s.id === 'warrior_cleave')!.rank).toBe(2);
  });

  it('ignores unknown / rank-0 entries', () => {
    const h = hero('mage', 5);
    h.skills = { nonsense: 3, mage_firebolt: 0 };
    expect(resolveSkills(h)).toEqual([]);
  });
});

describe('passiveStatMods -> deriveUnitStats', () => {
  it('a passive %-stat skill raises the derived stat', () => {
    const base = statsForLevel('mage', 12).atk;
    const h = hero('mage', 12);
    h.skills = { mage_focus: 3 }; // +5% atk per rank => +15%
    const mods = passiveStatMods(h);
    expect(mods).toEqual([{ stat: 'atk', value: 15, isPercent: true }]);
    expect(deriveUnitStats(h).atk).toBe(Math.round(base * 1.15));
  });

  it('no purchased passives -> stats unchanged', () => {
    const h = hero('warrior', 8);
    expect(deriveUnitStats(h)).toEqual(deriveUnitStats(hero('warrior', 8)));
  });
});

describe('skills in the simulation', () => {
  const run = (partyRoster: ReturnType<typeof hero>[], seed: number, stage: number, ticks: number) => {
    const slots: PartySlot[] = partyRoster.map((h, i) => ({
      classId: h.classId,
      line: i === 0 ? 'front' : 'back',
    }));
    const party = resolveParty(partyRoster, slots);
    const rng = mulberry32(hashSeed(seed, stage, 1));
    const state = createCombat({ party, stage, attempt: 1 });
    for (let i = 0; i < ticks && state.outcome === 'ongoing'; i++) stepCombat(state, TICK_SECONDS, rng);
    return state;
  };

  it('a mage with Nova casts it and logs a skill line', () => {
    const w = hero('warrior', 8);
    const m = hero('mage', 8);
    m.skills = { mage_nova: 3 };
    const state = run([w, m], 42, 3, 400);
    expect(state.log.some((l) => l.kind === 'skill' && l.vars?.skill === 'skill.mage_nova')).toBe(true);
  });

  it('enemies never gain skills', () => {
    const state = run([hero('warrior', 5), hero('mage', 5)], 1, 2, 50);
    for (const u of state.units) {
      if (u.team === 'enemy') expect(u.activeSkills).toEqual([]);
    }
  });

  it('stays deterministic with skills purchased', () => {
    const build = () => {
      const w = hero('warrior', 10);
      w.skills = { warrior_cleave: 3 };
      const p = hero('priest', 10);
      p.skills = { priest_heal: 3 };
      return [w, p];
    };
    const a = run(build(), 7, 4, 600);
    const b = run(build(), 7, 4, 600);
    const fp = (s: typeof a) =>
      JSON.stringify(s.units.map((u) => [u.id, Math.round(u.hp), Math.round(u.x)]));
    expect(fp(a)).toBe(fp(b));
  });

  it('priest Heal restores a hurt ally and logs it', () => {
    const w = hero('warrior', 10);
    const p = hero('priest', 10);
    p.skills = { priest_heal: 4 };
    const slots: PartySlot[] = [
      { classId: 'warrior', line: 'front' },
      { classId: 'priest', line: 'back' },
    ];
    const party = resolveParty([w, p], slots);
    const rng = mulberry32(hashSeed(1, 1, 1));
    const state = createCombat({ party, stage: 1, attempt: 1 });

    // Wound the warrior well past the 65% trigger.
    const warr = state.units.find((u) => u.kind === 'warrior')!;
    warr.hp = Math.round(warr.stats.maxHp * 0.25);
    const wounded = warr.hp;

    for (let i = 0; i < 80 && state.outcome === 'ongoing'; i++) {
      stepCombat(state, TICK_SECONDS, rng);
    }

    expect(state.log.some((l) => l.kind === 'heal')).toBe(true);
    const warrNow = state.units.find((u) => u.kind === 'warrior');
    // healed above where we left it (regen alone is tiny over this window)
    expect((warrNow?.hp ?? 0)).toBeGreaterThan(wounded + warr.stats.maxHp * 0.05);
  });
});

describe('skill content sanity', () => {
  it('every requires points at a real skill of the same class', () => {
    for (const def of Object.values(SKILLS)) {
      if (!def.requires) continue;
      const req = SKILLS[def.requires];
      expect(req, def.id).toBeTruthy();
      expect(req.classId).toBe(def.classId);
    }
  });

  it('every class has at least 4 skills', () => {
    for (const c of ['warrior', 'mage', 'priest', 'rogue']) {
      expect(skillsForClass(c).length).toBeGreaterThanOrEqual(4);
    }
  });
});
