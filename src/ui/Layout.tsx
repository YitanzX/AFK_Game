import { useState } from 'react';
import { useT } from '../i18n';
import { battleController } from '../game/state/battleController';
import { CombatCanvas } from './CombatCanvas';
import { PartyPanel } from './PartyPanel';

type Tab = 'battle' | 'party' | 'skills' | 'tree';
const TABS: Tab[] = ['battle', 'party', 'skills', 'tree'];
const SPEEDS = [1, 2, 4];

export function Layout() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('battle');
  const [speed, setSpeed] = useState(1);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    battleController.setSpeed(s);
  };

  return (
    <>
      <nav className="panel row">
        <div className="tabs">
          {TABS.map((id) => (
            <button
              key={id}
              className={id === tab ? 'active' : ''}
              disabled={id !== 'battle'}
              onClick={() => setTab(id)}
              title={id !== 'battle' ? t('tab.comingSoon') : undefined}
            >
              {t(`tab.${id}`)}
            </button>
          ))}
        </div>

        <div className="spacer" />

        <div className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {t('battle.speed')}
          </span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={s === speed ? 'active' : ''}
              onClick={() => changeSpeed(s)}
            >
              x{s}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'battle' ? (
        <div className="battle-layout">
          <CombatCanvas />
          <PartyPanel />
        </div>
      ) : (
        <div className="panel coming-soon">{t('tab.comingSoon')}</div>
      )}
    </>
  );
}
