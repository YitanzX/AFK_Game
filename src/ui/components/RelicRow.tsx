import { useT } from '../../i18n';
import { relicUpgradeVars, type RelicUpgrade } from '../../game/content/prestige';

interface Props {
  up: RelicUpgrade;
  rank: number;
  relics: number;
  onBuy: () => void;
}

export function RelicRow({ up, rank, relics, onBuy }: Props) {
  const { t } = useT();
  const maxed = rank >= up.maxRank;
  const canBuy = !maxed && relics >= up.costPerRank;
  const desc = t(up.descKey, relicUpgradeVars(up, Math.max(1, rank)));

  return (
    <div className={`skill-row${maxed ? ' maxed' : ''}`}>
      <div className="skill-main">
        <div className="skill-top">
          <span className="skill-name">{t(up.nameKey)}</span>
          <span className="pips">
            {Array.from({ length: up.maxRank }).map((_, i) => (
              <span key={i} className={i < rank ? 'pip on' : 'pip'} />
            ))}
          </span>
        </div>
        <div className="skill-desc muted">{desc}</div>
      </div>
      <div className="skill-action">
        {maxed ? (
          <span className="skill-tag maxed">{t('meta.maxed')}</span>
        ) : (
          <button className="primary" disabled={!canBuy} onClick={onBuy}>
            {up.costPerRank} ◆
          </button>
        )}
      </div>
    </div>
  );
}
