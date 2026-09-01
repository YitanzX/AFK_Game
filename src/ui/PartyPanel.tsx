import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useGameStore } from '../game/state/store';
import { battleController, type PartySlotHp } from '../game/state/battleController';
import { CLASSES } from '../game/content/classes';
import { deriveUnitStats } from '../game/systems/stats';
import { xpForLevel } from '../game/core/formulas';
import { Bar } from './components/Bar';
import { formatNumber } from './format';

/** Live hp per party index (incl. KO flag), sampled from the running battle. */
function usePartyHp(): Record<number, PartySlotHp> {
  const [data, setData] = useState<Record<number, PartySlotHp>>({});
  useEffect(() => {
    const id = setInterval(() => setData({ ...battleController.getPartyHp() }), 200);
    return () => clearInterval(id);
  }, []);
  return data;
}

export function PartyPanel() {
  const { t } = useT();
  const roster = useGameStore((s) => s.roster);
  const party = useGameStore((s) => s.party);
  const recentLevelUps = useGameStore((s) => s.recentLevelUps);
  const partyHp = usePartyHp();

  return (
    <aside className="panel">
      <h2 style={{ marginTop: 0, fontSize: 15 }}>{t('party.title')}</h2>
      <div className="party">
        {party.map((slot, partyIndex) => {
          const rosterIdx = roster.findIndex((r) => r.classId === slot.classId);
          const hero = roster[rosterIdx];
          if (!hero) return null;

          const cls = CLASSES[hero.classId];
          const live = partyHp[partyIndex];
          const maxHp = live?.maxHp ?? deriveUnitStats(hero).maxHp;
          const hp = live ? live.hp : maxHp;
          const alive = live ? live.alive : true;
          const xpNeeded = xpForLevel(hero.level);

          const classes = ['hero'];
          if (recentLevelUps.includes(rosterIdx)) classes.push('levelup');
          if (!alive) classes.push('dead');

          return (
            <div key={slot.classId} className={classes.join(' ')}>
              <div className="top">
                <span className="name">
                  {t(cls?.nameKey ?? hero.classId)}
                  <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>
                    {t(`party.line.${slot.line}`)}
                  </span>
                </span>
                {alive ? (
                  <span className="lvl">{t('party.level', { n: hero.level })}</span>
                ) : (
                  <span className="ko">{t('party.ko')}</span>
                )}
              </div>

              <div className="bar-label">
                <span>{t('party.hp')}</span>
                <span className="mono">
                  {formatNumber(Math.ceil(hp))} / {formatNumber(maxHp)}
                </span>
              </div>
              <Bar ratio={maxHp > 0 ? hp / maxHp : 0} kind="hp" />

              <div className="bar-label">
                <span>{t('party.xp')}</span>
                <span className="mono">
                  {formatNumber(hero.xp)} / {formatNumber(xpNeeded)}
                </span>
              </div>
              <Bar ratio={hero.xp / xpNeeded} kind="xp" />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
