/**
 * Aggregates the meta skill tree (and, from M4b, prestige upgrades + relics)
 * into a single `MetaBonuses` object that the rest of the game multiplies by.
 */

import { META_NODE_BY_ID, type MetaEffectKind } from '../content/metaTree';
import { RELIC_BY_ID } from '../content/prestige';

export interface MetaBonuses {
  xpMult: number;
  goldMult: number;
  atkMult: number;
  hpMult: number;
  defMult: number;
  atkSpeedMult: number;
  /** Flat crit chance added to every hero. */
  critAdd: number;
  /** Flat crit-damage multiplier added (e.g. 0.4 = +40% crit dmg). */
  critDmgAdd: number;
  /** Fraction of damage an ally heals back (0..~0.6). */
  lifestealPct: number;
  /** Skill cooldown multiplier (1 = normal, <1 = faster). */
  skillCdMult: number;
  dropMult: number;
  fragmentMult: number;
  /** Total offline cap in hours (12 base + tree). */
  afkCapHours: number;
  /** Max fielded heroes (4 base + tree). */
  partySlots: number;
}

const BASE_AFK_HOURS = 12;
const BASE_PARTY_SLOTS = 4;

function empty(): MetaBonuses {
  return {
    xpMult: 1,
    goldMult: 1,
    atkMult: 1,
    hpMult: 1,
    defMult: 1,
    atkSpeedMult: 1,
    critAdd: 0,
    critDmgAdd: 0,
    lifestealPct: 0,
    skillCdMult: 1,
    dropMult: 1,
    fragmentMult: 1,
    afkCapHours: BASE_AFK_HOURS,
    partySlots: BASE_PARTY_SLOTS,
  };
}

function applyEffect(b: MetaBonuses, kind: MetaEffectKind, amount: number): void {
  switch (kind) {
    case 'xpMult': b.xpMult += amount; break;
    case 'goldMult': b.goldMult += amount; break;
    case 'atkMult': b.atkMult += amount; break;
    case 'hpMult': b.hpMult += amount; break;
    case 'defMult': b.defMult += amount; break;
    case 'atkSpeedMult': b.atkSpeedMult += amount; break;
    case 'critAdd': b.critAdd += amount; break;
    case 'critDmgAdd': b.critDmgAdd += amount; break;
    case 'lifestealPct': b.lifestealPct += amount; break;
    case 'skillCdMult': b.skillCdMult += amount; break;
    case 'dropMult': b.dropMult += amount; break;
    case 'fragmentMult': b.fragmentMult += amount; break;
    case 'afkCapHours': b.afkCapHours += amount; break;
    case 'partySlots': b.partySlots += amount; break;
  }
}

export interface MetaInput {
  metaTree?: Record<string, number>;
  prestigeUpgrades?: Record<string, number>;
  relics?: number;
}

export function computeMetaBonuses(input: MetaInput): MetaBonuses {
  const b = empty();

  for (const [id, rank] of Object.entries(input.metaTree ?? {})) {
    const node = META_NODE_BY_ID[id];
    if (!node || rank < 1) continue;
    const eff = Math.min(rank, node.maxRank);
    for (const e of node.effects) applyEffect(b, e.kind, e.perRank * eff);
  }

  for (const [id, rank] of Object.entries(input.prestigeUpgrades ?? {})) {
    const up = RELIC_BY_ID[id];
    if (!up || rank < 1) continue;
    for (const e of up.metaEffects ?? []) {
      applyEffect(b, e.kind, e.perRank * Math.min(rank, up.maxRank));
    }
  }

  b.partySlots = Math.round(b.partySlots);
  b.skillCdMult = Math.max(0.4, b.skillCdMult);
  b.lifestealPct = Math.min(0.6, b.lifestealPct);
  return b;
}
