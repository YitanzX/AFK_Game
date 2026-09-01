import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useGameStore } from '../game/state/store';
import { battleController, type PartySlotHp } from '../game/state/battleController';
import { CLASSES, statsForLevel } from '../game/content/classes';
import { xpForLevel } from '../game/core/formulas';
import { Bar } from './components/Bar';
import { formatNumber } from './format';

/** Live hp per roster slot (incl. KO flag), sampled from the running battle. */
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
  const recentLevelUps = useGameStore((s) => s.recentLevelUps);
  const partyHp = usePartyHp();

  return (
    <aside className="panel">
      <h2 style={{ marginTop: 0, fontSize: 15 }}>{t('party.title')}</h2>
      <div className="party">
        {roster.map((hero, i) => {
          const cls = CLASSES[hero.classId];
          const slot = partyHp[i];
          const maxHp = slot?.maxHp ?? statsForLevel(hero.classId, hero.level).maxHp;
          const hp = slot ? slot.hp : maxHp;
          const alive = slot ? slot.alive : true;
          const xpNeeded = xpForLevel(hero.level);
          const classes = ['hero'];
          if (recentLevelUps.includes(i)) classes.push('levelup');
          if (!alive) classes.push('dead');
          return (
            <div key={i} className={classes.join(' ')}>
              <div className="top">
                <span className="name">{t(cls?.nameKey ?? hero.classId)}</span>
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
