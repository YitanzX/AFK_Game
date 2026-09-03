import { useState } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import {
  META_BRANCHES,
  META_NODES,
  META_NODE_BY_ID,
  describeMetaNode,
  nodeCost,
  type MetaBranch,
} from '../../game/content/metaTree';
import { RELIC_UPGRADES, relicGain } from '../../game/content/prestige';
import { computeMetaBonuses } from '../../game/systems/meta';
import { TreeGraph, CELL_W, type GraphEdge, type GraphNode, type NodeState } from '../components/TreeGraph';
import { RelicRow } from '../components/RelicRow';
import { formatNumber } from '../format';

const BRANCH_GLYPH: Record<MetaBranch, string> = {
  offense: 'sword',
  defense: 'shield',
  economy: 'coin',
  utility: 'gear',
  sustain: 'cross',
  fortune: 'coin',
  mastery: 'spark',
  command: 'shield',
};
const BRANCH_COLOR: Record<MetaBranch, string> = {
  offense: '#e35b5b',
  defense: '#4f8fd6',
  economy: '#ffcb47',
  utility: '#6fcf6f',
  sustain: '#e07ab0',
  fortune: '#f2a25c',
  mastery: '#a06cff',
  command: '#7fd0d0',
};

const pct = (n: number) => `+${Math.round((n - 1) * 100)}%`;

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
  const [selected, setSelected] = useState<string | null>(null);

  const m = computeMetaBonuses({ metaTree, prestigeUpgrades, relics });
  const anyNode = Object.values(metaTree).some((r) => r > 0);
  const gain = relicGain(Math.max(bestStageEver, maxStageCleared));

  // --- graph layout: one column per branch ---------------------------
  const perBranch = Object.fromEntries(
    META_BRANCHES.map((b) => [b, [] as string[]]),
  ) as Record<MetaBranch, string[]>;
  for (const node of META_NODES) perBranch[node.branch].push(node.id);
  const rows = Math.max(...META_BRANCHES.map((b) => perBranch[b].length));

  const nodeState = (id: string): NodeState => {
    const node = META_NODE_BY_ID[id];
    const rank = metaTree[id] ?? 0;
    if (rank >= node.maxRank) return 'maxed';
    if (node.requires && (metaTree[node.requires] ?? 0) < 1) return 'locked';
    return rank > 0 ? 'owned' : 'available';
  };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  META_BRANCHES.forEach((branch, col) => {
    const ids = perBranch[branch];
    ids.forEach((id, row) => {
      const node = META_NODE_BY_ID[id];
      nodes.push({
        id,
        col,
        row,
        glyph: BRANCH_GLYPH[branch],
        color: BRANCH_COLOR[branch],
        rank: metaTree[id] ?? 0,
        maxRank: node.maxRank,
        state: nodeState(id),
        selected: selected === id,
        title: t(node.nameKey),
      });
      if (row > 0 && ids[row - 1] !== node.requires) {
        edges.push({ from: ids[row - 1], to: id, active: (metaTree[ids[row - 1]] ?? 0) >= 1 });
      }
      if (node.requires) {
        edges.push({ from: node.requires, to: id, active: (metaTree[node.requires] ?? 0) >= 1 });
      }
    });
  });

  const sel = selected ? META_NODE_BY_ID[selected] : null;
  const selRank = sel ? metaTree[sel.id] ?? 0 : 0;
  const selCost = sel ? nodeCost(sel, selRank) : 0;
  const prereqMet = !sel?.requires || (metaTree[sel.requires] ?? 0) >= 1;
  const canBuy = sel && selRank < sel.maxRank && prereqMet && gold >= selCost;

  const summary = [
    m.xpMult > 1 && `${pct(m.xpMult)} XP`,
    m.goldMult > 1 && `${pct(m.goldMult)} ${t('resource.gold')}`,
    m.atkMult > 1 && `${pct(m.atkMult)} ATQ`,
    m.hpMult > 1 && `${pct(m.hpMult)} PV`,
    m.defMult > 1 && `${pct(m.defMult)} DEF`,
    m.atkSpeedMult > 1 && `${pct(m.atkSpeedMult)} ⚡`,
    m.critAdd > 0 && `+${Math.round(m.critAdd * 100)}% crit`,
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

      <div className="tree-scroll">
        <div style={{ minWidth: META_BRANCHES.length * CELL_W, margin: '0 auto' }}>
          <div
            className="tree-branch-labels"
            style={{ gridTemplateColumns: `repeat(${META_BRANCHES.length}, ${CELL_W}px)` }}
          >
            {META_BRANCHES.map((b) => (
              <span key={b} style={{ color: BRANCH_COLOR[b] }}>
                {t(`meta.branch.${b}`)}
              </span>
            ))}
          </div>
          <TreeGraph
            nodes={nodes}
            edges={edges}
            cols={META_BRANCHES.length}
            rows={rows}
            onSelect={setSelected}
            embedded
          />
        </div>
      </div>

      {sel && (
        <div className="node-detail">
          <div className="node-detail-main">
            <div className="skill-top">
              <strong>{t(sel.nameKey)}</strong>
              <span className="muted">{t('skills.rank', { r: selRank, max: sel.maxRank })}</span>
            </div>
            <p className="muted" style={{ margin: '4px 0' }}>
              {describeMetaNode(sel, selRank, t)}
            </p>
            {!prereqMet && sel.requires && (
              <div className="skill-req bad">
                {t('meta.locked', { name: t(META_NODE_BY_ID[sel.requires]?.nameKey ?? sel.requires) })}
              </div>
            )}
          </div>
          {selRank >= sel.maxRank ? (
            <span className="skill-tag maxed">{t('meta.maxed')}</span>
          ) : (
            <button className="primary" disabled={!canBuy} onClick={() => buyMetaNode(sel.id)}>
              {t('meta.cost', { n: formatNumber(selCost) })}
            </button>
          )}
        </div>
      )}

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
