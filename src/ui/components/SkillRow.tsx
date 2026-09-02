import { useT } from '../../i18n';
import { skillVars, type SkillDef } from '../../game/content/skills';

interface SkillRowProps {
  def: SkillDef;
  rank: number;
  heroLevel: number;
  points: number;
  learned: Set<string>;
  reqName?: string;
  onBuy: () => void;
}

export function SkillRow({ def, rank, heroLevel, points, learned, reqName, onBuy }: SkillRowProps) {
  const { t } = useT();

  const maxed = rank >= def.maxRank;
  const needLevel = heroLevel < def.unlockLevel;
  const needReq = def.requires ? !learned.has(def.requires) : false;
  const canAfford = points >= def.costPerRank;
  const canBuy = !maxed && !needLevel && !needReq && canAfford;

  // Show current rank values, or a rank-1 preview when not yet learned.
  const shownRank = Math.max(1, rank);
  const desc = t(def.descKey, skillVars(def, shownRank));

  return (
    <div className={`skill-row${maxed ? ' maxed' : ''}${needLevel || needReq ? ' locked' : ''}`}>
      <div className="skill-main">
        <div className="skill-top">
          <span className="skill-name">{t(def.nameKey)}</span>
          {def.kind === 'passive' && <span className="skill-tag">{t('skills.passive')}</span>}
          <span className="pips">
            {Array.from({ length: def.maxRank }).map((_, i) => (
              <span key={i} className={i < rank ? 'pip on' : 'pip'} />
            ))}
          </span>
        </div>
        <div className="skill-desc muted">{desc}</div>
        {needLevel && (
          <div className="skill-req bad">{t('skills.needLevel', { n: def.unlockLevel })}</div>
        )}
        {needReq && reqName && (
          <div className="skill-req bad">{t('skills.needSkill', { name: reqName })}</div>
        )}
      </div>

      <div className="skill-action">
        {maxed ? (
          <span className="skill-tag maxed">{t('skills.maxed')}</span>
        ) : (
          <button className="primary" disabled={!canBuy} onClick={onBuy}>
            {rank === 0
              ? t('skills.learn', { c: def.costPerRank })
              : t('skills.upgrade', { c: def.costPerRank })}
          </button>
        )}
      </div>
    </div>
  );
}
