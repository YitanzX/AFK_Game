import { useState } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import { CLASSES, MAX_PARTY } from '../../game/content/classes';
import { deriveUnitStats } from '../../game/systems/stats';
import { RECRUIT_ORDER, recruitCost, isUnlocked } from '../../game/systems/recruit';
import type { RosterUnit } from '../../game/core/types';
import { Bar } from '../components/Bar';
import { formatNumber } from '../format';
import { CharacterSheet } from './CharacterSheet';

function HeroCard({
  unit,
  line,
  fielded,
  onSheet,
}: {
  unit: RosterUnit;
  line?: 'front' | 'back';
  fielded: boolean;
  onSheet: () => void;
}) {
  const { t } = useT();
  const partyLen = useGameStore((s) => s.party.length);
  const fieldHero = useGameStore((s) => s.fieldHero);
  const benchHero = useGameStore((s) => s.benchHero);
  const setLine = useGameStore((s) => s.setLine);
  const cls = CLASSES[unit.classId];
  const stats = deriveUnitStats(unit);

  return (
    <div className="hero party-hero">
      <div className="top">
        <span className="name">{t(cls?.nameKey ?? unit.classId)}</span>
        <span className="lvl">{t('party.level', { n: unit.level })}</span>
      </div>
      <div className="hero-stats mono muted">
        {t('stat.maxHp')} {formatNumber(stats.maxHp)} · {t('stat.atk')} {formatNumber(stats.atk)} ·{' '}
        {t('stat.def')} {formatNumber(stats.def)}
      </div>
      <div className="row hero-actions">
        <button onClick={onSheet}>{t('party.sheet')}</button>
        {fielded ? (
          <>
            <button onClick={() => setLine(unit.classId, line === 'front' ? 'back' : 'front')}>
              {line === 'front' ? t('party.toBack') : t('party.toFront')}
            </button>
            <button onClick={() => benchHero(unit.classId)}>{t('party.sendToBench')}</button>
          </>
        ) : (
          <button
            className="primary"
            disabled={partyLen >= MAX_PARTY}
            onClick={() => fieldHero(unit.classId)}
          >
            {t('party.field')}
          </button>
        )}
      </div>
    </div>
  );
}

export function PartyTab() {
  const { t } = useT();
  const roster = useGameStore((s) => s.roster);
  const party = useGameStore((s) => s.party);
  const fragments = useGameStore((s) => s.fragments);
  const recentRecruits = useGameStore((s) => s.recentRecruits);
  const dismissRecruits = useGameStore((s) => s.dismissRecruits);

  const [sheetClassId, setSheetClassId] = useState<string | null>(null);

  const fieldedIds = new Set(party.map((p) => p.classId));
  const bench = roster.filter((r) => !fieldedIds.has(r.classId));
  const emptySlots = Math.max(0, MAX_PARTY - party.length);

  return (
    <div className="panel tab-scroll">
      {recentRecruits.length > 0 && (
        <div className="toast" onClick={dismissRecruits}>
          {recentRecruits
            .map((c) => t('party.recruited', { hero: t(`class.${c}`) }))
            .join('  ')}
        </div>
      )}

      <h3>{t('party.active')}</h3>
      <div className="party-grid">
        {party.map((slot) => {
          const unit = roster.find((r) => r.classId === slot.classId);
          if (!unit) return null;
          return (
            <div key={slot.classId} className={`slot line-${slot.line}`}>
              <span className="slot-line muted">{t(`party.line.${slot.line}`)}</span>
              <HeroCard
                unit={unit}
                line={slot.line}
                fielded
                onSheet={() => setSheetClassId(slot.classId)}
              />
            </div>
          );
        })}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`empty-${i}`} className="slot empty">
            {t('party.empty')}
          </div>
        ))}
      </div>

      {bench.length > 0 && (
        <>
          <h3>{t('party.bench')}</h3>
          <div className="party-grid">
            {bench.map((unit) => (
              <HeroCard
                key={unit.classId}
                unit={unit}
                fielded={false}
                onSheet={() => setSheetClassId(unit.classId)}
              />
            ))}
          </div>
        </>
      )}

      <h3>{t('party.fragments')}</h3>
      {RECRUIT_ORDER.every((c) => isUnlocked(roster, c)) ? (
        <p className="muted">{t('party.allRecruited')}</p>
      ) : (
        RECRUIT_ORDER.filter((c) => !isUnlocked(roster, c)).map((c) => {
          const cost = recruitCost(c);
          const cur = Math.min(cost, fragments[c] ?? 0);
          return (
            <div key={c} className="frag-row">
              <div className="bar-label">
                <span>{t(`class.${c}`)}</span>
                <span className="mono">
                  {formatNumber(cur)} / {formatNumber(cost)}
                </span>
              </div>
              <Bar ratio={cur / cost} kind="xp" />
            </div>
          );
        })
      )}

      {sheetClassId && (
        <CharacterSheet classId={sheetClassId} onClose={() => setSheetClassId(null)} />
      )}
    </div>
  );
}
