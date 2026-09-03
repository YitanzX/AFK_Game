import { useState } from 'react';
import { useT } from '../i18n';
import { battleController } from '../game/state/battleController';
import { CombatCanvas } from './CombatCanvas';
import { PartyPanel } from './PartyPanel';
import { CombatLog } from './CombatLog';
import { PartyTab } from './tabs/PartyTab';
import { InventoryTab } from './tabs/InventoryTab';
import { SkillsTab } from './tabs/SkillsTab';
import { TreeTab } from './tabs/TreeTab';

type Tab = 'battle' | 'party' | 'inventory' | 'skills' | 'tree';
const TABS: Tab[] = ['battle', 'party', 'inventory', 'skills', 'tree'];
const ENABLED: Tab[] = ['battle', 'party', 'inventory', 'skills', 'tree'];
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
          {TABS.map((id) => {
            const enabled = ENABLED.includes(id);
            return (
              <button
                key={id}
                className={id === tab ? 'active' : ''}
                disabled={!enabled}
                onClick={() => setTab(id)}
                title={enabled ? undefined : t('tab.comingSoon')}
              >
                {t(`tab.${id}`)}
              </button>
            );
          })}
        </div>

        <div className="spacer" />

        {tab === 'battle' && (
          <div className="row" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t('battle.speed')}
            </span>
            {SPEEDS.map((s) => (
              <button key={s} className={s === speed ? 'active' : ''} onClick={() => changeSpeed(s)}>
                x{s}
              </button>
            ))}
          </div>
        )}
      </nav>

      {tab === 'battle' && (
        <div className="battle-layout">
          <CombatCanvas />
          <div className="battle-side">
            <PartyPanel />
            <CombatLog />
          </div>
        </div>
      )}
      {tab === 'party' && <PartyTab />}
      {tab === 'inventory' && <InventoryTab />}
      {tab === 'skills' && <SkillsTab />}
      {tab === 'tree' && <TreeTab />}
    </>
  );
}
