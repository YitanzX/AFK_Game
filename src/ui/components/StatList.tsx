import type { Stats } from '../../game/core/types';
import { useT } from '../../i18n';
import { formatNumber } from '../format';

type StatKey = keyof Stats;

const SHOWN: StatKey[] = [
  'maxHp',
  'atk',
  'def',
  'critChance',
  'attackSpeed',
  'range',
  'moveSpeed',
];

function fmt(key: StatKey, v: number): string {
  if (key === 'critChance') return `${(v * 100).toFixed(1)}%`;
  if (key === 'attackSpeed') return v.toFixed(2);
  if (key === 'critDmg') return `${v.toFixed(2)}x`;
  return formatNumber(Math.round(v));
}

function delta(key: StatKey, v: number): string {
  const sign = v > 0 ? '+' : '−';
  const abs = Math.abs(v);
  if (key === 'critChance') return `${sign}${(abs * 100).toFixed(1)}%`;
  if (key === 'attackSpeed') return `${sign}${abs.toFixed(2)}`;
  return `${sign}${formatNumber(Math.round(abs))}`;
}

interface StatListProps {
  stats: Stats;
  /** If given, show the difference `stats - compare` next to each value. */
  compare?: Stats;
}

export function StatList({ stats, compare }: StatListProps) {
  const { t } = useT();
  return (
    <dl className="statlist">
      {SHOWN.map((key) => {
        const d = compare ? stats[key] - compare[key] : 0;
        return (
          <div key={key} className="statlist-row">
            <dt>{t(`stat.${key}`)}</dt>
            <dd className="mono">
              {fmt(key, stats[key])}
              {compare && Math.abs(d) > 1e-6 && (
                <span className={d > 0 ? 'delta up' : 'delta down'}> {delta(key, d)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
