import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import { CLASSES } from '../../game/content/classes';
import { SKILLS, skillsForClass, availablePoints } from '../../game/content/skills';
import { SkillRow } from '../components/SkillRow';

export function SkillsTab() {
  const { t } = useT();
  const roster = useGameStore((s) => s.roster);
  const spendSkillPoint = useGameStore((s) => s.spendSkillPoint);
  const respecSkills = useGameStore((s) => s.respecSkills);

  const [classId, setClassId] = useState<string>(roster[0]?.classId ?? 'warrior');
  useEffect(() => {
    if (!roster.some((r) => r.classId === classId) && roster[0]) setClassId(roster[0].classId);
  }, [roster, classId]);

  const hero = roster.find((r) => r.classId === classId);
  if (!hero) return null;

  const points = availablePoints(hero);
  const learned = new Set(Object.keys(hero.skills).filter((id) => hero.skills[id] > 0));

  return (
    <div className="panel tab-scroll">
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs">
          {roster.map((r) => (
            <button
              key={r.classId}
              className={r.classId === classId ? 'active' : ''}
              onClick={() => setClassId(r.classId)}
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

      <div className="skill-list">
        {skillsForClass(classId).map((def) => (
          <SkillRow
            key={def.id}
            def={def}
            rank={hero.skills[def.id] ?? 0}
            heroLevel={hero.level}
            points={points}
            learned={learned}
            reqName={def.requires ? t(SKILLS[def.requires]?.nameKey ?? def.requires) : undefined}
            onBuy={() => spendSkillPoint(classId, def.id)}
          />
        ))}
      </div>
    </div>
  );
}
