import type { ReactNode } from 'react';
import type { Affix, Item, Rarity } from '../../game/core/items';
import { useT } from '../../i18n';

type T = (k: string, vars?: Record<string, string | number>) => string;

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b7c0d8',
  uncommon: '#5ad17a',
  rare: '#6c8cff',
  epic: '#c874ff',
};

export function itemName(item: Item, t: T): string {
  return `${t(`rarity.${item.rarity}`)} ${t(`slot.${item.slot}`)}`;
}

/** "+42 ATK", "+6% Atk Spd", "+2.4% Crit". */
export function formatAffix(a: Affix, t: T): string {
  const stat = t(`stat.${a.stat}`);
  if (a.isPercent) return t('affix.pct', { v: round1(a.value), stat });
  if (a.stat === 'critChance') return t('affix.pct', { v: round1(a.value * 100), stat });
  return t('affix.flat', { v: round1(a.value), stat });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function AffixLines({ item }: { item: Item }) {
  const { t } = useT();
  return (
    <ul className="affixes">
      {item.affixes.map((a, i) => (
        <li key={i}>{formatAffix(a, t)}</li>
      ))}
    </ul>
  );
}

interface ItemCardProps {
  item: Item;
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export function ItemCard({ item, selected, onClick, children }: ItemCardProps) {
  const { t } = useT();
  const color = RARITY_COLOR[item.rarity];
  return (
    <div
      className={`item-card${selected ? ' selected' : ''}${onClick ? ' clickable' : ''}`}
      style={{ borderColor: color }}
      onClick={onClick}
    >
      <div className="item-head">
        <span className="item-name" style={{ color }}>
          {itemName(item, t)}
        </span>
        <span className="item-ilvl muted mono">i{item.ilvl}</span>
      </div>
      <AffixLines item={item} />
      {children}
    </div>
  );
}
