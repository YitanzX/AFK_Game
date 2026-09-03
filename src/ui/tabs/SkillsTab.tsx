import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import { CLASSES } from '../../game/content/classes';
import { SKILLS, skillsForClass, availablePoints, skillVars } from '../../game/content/skills';
import { TreeGraph, type GraphEdge, type GraphNode, type NodeState } from '../components/TreeGraph';

const ACTIVE_COLOR = '#4f8fd6';
const PASSIVE_COLOR = '#ffcb47';

export function SkillsTab() {
  const { t } = useT();
  const roster = useGameStore((s) => s.roster);
  const spendSkillPoint = useGameStore((s) => s.spendSkillPoint);
  const respecSkills = useGameStore((s) => s.respecSkills);

  const [classId, setClassId] = useState<string>(roster[0]?.classId ?? 'warrior');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!roster.some((r) => r.classId === classId) && roster[0]) setClassId(roster[0].classId);
  }, [roster, classId]);

  const hero = roster.find((r) => r.classId === classId);
  const defs = useMemo(() => skillsForClass(classId).slice().sort((a, b) => a.unlockLevel - b.unlockLevel), [classId]);

  if (!hero) return null;
  const points = availablePoints(hero);
  const learned = new Set(Object.keys(hero.skills).filter((id) => hero.skills[id] > 0));

  const nodeState = (id: string): NodeState => {
    const def = SKILLS[id];
    const rank = hero.skills[id] ?? 0;
    if (rank >= def.maxRank) return 'maxed';
    const okLevel = hero.level >= def.unlockLevel;
    const okReq = !def.requires || learned.has(def.requires);
    if (!okLevel || !okReq) return 'locked';
    return rank > 0 ? 'owned' : 'available';
  };

  // grid layout: one row per distinct unlock level, columns for skills sharing it
  const tiers = [...new Set(defs.map((d) => d.unlockLevel))].sort((a, b) => a - b);
  let cols = 1;
  const nodes: GraphNode[] = defs.map((def) => {
    const sameLevel = defs.filter((d) => d.unlockLevel === def.unlockLevel);
    cols = Math.max(cols, sameLevel.length);
    return {
      id: def.id,
      col: sameLevel.indexOf(def),
      row: tiers.indexOf(def.unlockLevel),
      glyph: def.kind === 'passive' ? 'gear' : 'spark',
      color: def.kind === 'passive' ? PASSIVE_COLOR : ACTIVE_COLOR,
      rank: hero.skills[def.id] ?? 0,
      maxRank: def.maxRank,
      state: nodeState(def.id),
      selected: selected === def.id,
      title: t(def.nameKey),
    };
  });

  const edges: GraphEdge[] = [];
  for (const def of defs) {
    if (def.requires) edges.push({ from: def.requires, to: def.id, active: learned.has(def.requires) });
  }

  const sel = selected ? SKILLS[selected] : null;
  const selRank = sel ? hero.skills[sel.id] ?? 0 : 0;
  const canBuy =
    sel &&
    selRank < sel.maxRank &&
    hero.level >= sel.unlockLevel &&
    (!sel.requires || learned.has(sel.requires)) &&
    points >= sel.costPerRank;

  return (
    <div className="panel tab-scroll">
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs">
          {roster.map((r) => (
            <button
              key={r.classId}
              className={r.classId === classId ? 'active' : ''}
              onClick={() => {
                setClassId(r.classId);
                setSelected(null);
              }}
            >
              {t(CLASSES[r.classId]?.nameKey ?? r.classId)}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <strong className="points-chip">{t('skills.points', { n: points })}</strong>
        <button disabled={learned.size === 0} onClick={() => respecSkills(classId)}>
          {t('skills.respec')}
        </button>
      </div>

      <TreeGraph nodes={nodes} edges={edges} cols={cols} rows={tiers.length} onSelect={setSelected} />

      {sel && (
        <div className="node-detail">
          <div className="node-detail-main">
            <div className="skill-top">
              <strong>{t(sel.nameKey)}</strong>
              {sel.kind === 'passive' && <span className="skill-tag">{t('skills.passive')}</span>}
              <span className="muted">{t('skills.rank', { r: selRank, max: sel.maxRank })}</span>
            </div>
            <p className="muted" style={{ margin: '4px 0' }}>
              {t(sel.descKey, skillVars(sel, Math.max(1, selRank)))}
            </p>
            {hero.level < sel.unlockLevel && (
              <div className="skill-req bad">{t('skills.needLevel', { n: sel.unlockLevel })}</div>
            )}
            {sel.requires && !learned.has(sel.requires) && (
              <div className="skill-req bad">
                {t('skills.needSkill', { name: t(SKILLS[sel.requires]?.nameKey ?? sel.requires) })}
              </div>
            )}
          </div>
          {selRank >= sel.maxRank ? (
            <span className="skill-tag maxed">{t('skills.maxed')}</span>
          ) : (
            <button className="primary" disabled={!canBuy} onClick={() => spendSkillPoint(classId, sel.id)}>
              {selRank === 0
                ? t('skills.learn', { c: sel.costPerRank })
                : t('skills.upgrade', { c: sel.costPerRank })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
