import { useT } from '../../i18n';
import { metaNodeVars, nodeCost, type MetaNode } from '../../game/content/metaTree';
import { formatNumber } from '../format';

interface Props {
  node: MetaNode;
  rank: number;
  gold: number;
  prereqMet: boolean;
  reqName?: string;
  onBuy: () => void;
}

export function MetaNodeRow({ node, rank, gold, prereqMet, reqName, onBuy }: Props) {
  const { t } = useT();
  const maxed = rank >= node.maxRank;
  const cost = nodeCost(node, rank);
  const canBuy = !maxed && prereqMet && gold >= cost;
  const desc = t(node.descKey, metaNodeVars(node, Math.max(1, rank)));

  return (
    <div className={`skill-row${maxed ? ' maxed' : ''}${!prereqMet ? ' locked' : ''}`}>
      <div className="skill-main">
        <div className="skill-top">
          <span className="skill-name">{t(node.nameKey)}</span>
          <span className="pips">
            {Array.from({ length: node.maxRank }).map((_, i) => (
              <span key={i} className={i < rank ? 'pip on' : 'pip'} />
            ))}
          </span>
        </div>
        <div className="skill-desc muted">{desc}</div>
        {!prereqMet && reqName && (
          <div className="skill-req bad">{t('meta.locked', { name: reqName })}</div>
        )}
      </div>
      <div className="skill-action">
        {maxed ? (
          <span className="skill-tag maxed">{t('meta.maxed')}</span>
        ) : (
          <button className="primary" disabled={!canBuy} onClick={onBuy}>
            {t('meta.cost', { n: formatNumber(cost) })}
          </button>
        )}
      </div>
    </div>
  );
}
