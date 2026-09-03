import { useState } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import {
  META_BRANCHES,
  META_NODES,
  META_NODE_BY_ID,
} from '../../game/content/metaTree';
import { RELIC_UPGRADES, relicGain } from '../../game/content/prestige';
import { computeMetaBonuses } from '../../game/systems/meta';
import { MetaNodeRow } from '../components/MetaNodeRow';
import { RelicRow } from '../components/RelicRow';
import { formatNumber } from '../format';

function pct(n: number): string {
  return `+${Math.round((n - 1) * 100)}%`;
}

export function TreeTab() {
  const { t } = useT();
  const gold = useGameStore((s) => s.gold);
  const metaTree = useGameStore((s) => s.metaTree);
  const relics = useGameStore((s) => s.relics);
  const prestigeUpgrades = useGameStore((s) => s.prestigeUpgrades);
  const prestigeCount = useGameStore((s) => s.prestigeCount);
  const bestStageEver = useGameStore((s) => s.bestStageEver);
  const maxStageCleared = useGameStore((s) => s.maxStageCleared);
  const buyMetaNode = useGameStore((s) => s.buyMetaNode);
  const respecMetaTree = useGameStore((s) => s.respecMetaTree);
  const buyRelicUpgrade = useGameStore((s) => s.buyRelicUpgrade);
  const prestige = useGameStore((s) => s.prestige);

  const [confirming, setConfirming] = useState(false);

  const m = computeMetaBonuses({ metaTree, prestigeUpgrades, relics });
  const anyNode = Object.values(metaTree).some((r) => r > 0);
  const gain = relicGain(Math.max(bestStageEver, maxStageCleared));

  const summary = [
    m.xpMult > 1 && `${pct(m.xpMult)} XP`,
    m.goldMult > 1 && `${pct(m.goldMult)} ${t('resource.gold')}`,
    m.atkMult > 1 && `${pct(m.atkMult)} ATQ`,
    m.hpMult > 1 && `${pct(m.hpMult)} PV`,
    m.defMult > 1 && `${pct(m.defMult)} DEF`,
    m.atkSpeedMult > 1 && `${pct(m.atkSpeedMult)} ⚡`,
    m.critAdd > 0 && `+${Math.round(m.critAdd * 100)}% crít`,
    m.dropMult > 1 && `${pct(m.dropMult)} drop`,
    m.fragmentMult > 1 && `${pct(m.fragmentMult)} frag`,
    m.afkCapHours !== 12 && t('meta.afkcap', { n: m.afkCapHours }),
    m.partySlots !== 4 && t('meta.slots', { n: m.partySlots }),
  ].filter(Boolean) as string[];

  return (
    <div className="panel tab-scroll">
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="stat">
          <span className="label">{t('resource.gold')}</span>
          <span className="value gold mono">{formatNumber(gold)}</span>
        </span>
        <div className="spacer" />
        <button disabled={!anyNode} onClick={respecMetaTree}>
          {t('meta.respec')}
        </button>
      </div>

      <div className="meta-summary">
        <span className="muted">{t('meta.summary')}: </span>
        {summary.length > 0 ? summary.join(' · ') : <span className="muted">{t('meta.none')}</span>}
      </div>

      <div className="meta-branches">
        {META_BRANCHES.map((branch) => (
          <div key={branch} className="meta-branch">
            <h3>{t(`meta.branch.${branch}`)}</h3>
            {META_NODES.filter((n) => n.branch === branch).map((node) => {
              const req = node.requires ? META_NODE_BY_ID[node.requires] : undefined;
              return (
                <MetaNodeRow
                  key={node.id}
                  node={node}
                  rank={metaTree[node.id] ?? 0}
                  gold={gold}
                  prereqMet={!node.requires || (metaTree[node.requires] ?? 0) >= 1}
                  reqName={req ? t(req.nameKey) : undefined}
                  onBuy={() => buyMetaNode(node.id)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <h3>{t('prestige.title')}</h3>
      <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
        <span>◆ {t('prestige.relics', { n: formatNumber(relics) })}</span>
        <span className="muted">{t('prestige.count', { n: prestigeCount })}</span>
        <span className="muted">
          {t('prestige.best', { n: Math.max(bestStageEver, maxStageCleared) })}
        </span>
        <div className="spacer" />
        <button className="primary" disabled={gain <= 0} onClick={() => setConfirming(true)}>
          {gain > 0 ? t('prestige.button', { n: gain }) : t('prestige.tooLow')}
        </button>
      </div>

      <div className="meta-branch" style={{ marginTop: 12 }}>
        {RELIC_UPGRADES.map((up) => (
          <RelicRow
            key={up.id}
            up={up}
            rank={prestigeUpgrades[up.id] ?? 0}
            relics={relics}
            onBuy={() => buyRelicUpgrade(up.id)}
          />
        ))}
      </div>

      {confirming && (
        <div className="modal-backdrop" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('prestige.confirmTitle')}</h2>
            <p className="muted">{t('prestige.confirmBody', { n: gain })}</p>
            <div className="row">
              <div className="spacer" />
              <button onClick={() => setConfirming(false)}>{t('prestige.cancel')}</button>
              <button
                className="primary"
                onClick={() => {
                  prestige();
                  setConfirming(false);
                }}
              >
                {t('prestige.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
