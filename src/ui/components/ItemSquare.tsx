import type { DragEvent } from 'react';
import type { Item, ItemSlot } from '../../game/core/items';
import { useT } from '../../i18n';
import { RARITY_COLOR, formatAffix, itemName } from './ItemCard';

/** Emoji glyph per equipment slot (crossed swords / shield / ring). */
export const GLYPH: Record<ItemSlot, string> = {
  weapon: '⚔️',
  armor: '\u{1F6E1}️',
  accessory: '\u{1F48D}',
};

interface ItemSquareProps {
  item: Item;
  selected?: boolean;
  /** How this square identifies itself to a drop target. */
  dragPayload: string;
  onClick?: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  size?: 'grid' | 'slot';
}

/** A single draggable item cell: rarity border, slot glyph, ilvl badge, tooltip. */
export function ItemSquare({
  item,
  selected,
  dragPayload,
  onClick,
  onDragStart,
  onDragEnd,
  size = 'grid',
}: ItemSquareProps) {
  const { t } = useT();
  const color = RARITY_COLOR[item.rarity];

  return (
    <div
      className={`item-square rarity-${item.rarity}${selected ? ' selected' : ''} sq-${size}`}
      style={{ borderColor: color }}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', dragPayload);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(e);
      }}
      onDragEnd={onDragEnd}
    >
      <span className="sq-glyph" aria-hidden>
        {GLYPH[item.slot]}
      </span>
      <span className="sq-ilvl mono">{item.ilvl}</span>

      <div className="sq-tip" role="tooltip">
        <div className="sq-tip-name" style={{ color }}>
          {itemName(item, t)} <span className="muted">i{item.ilvl}</span>
        </div>
        <ul className="affixes">
          {item.affixes.map((a, i) => (
            <li key={i}>{formatAffix(a, t)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** An equipment slot: shows its item (draggable) or an empty ghost glyph. */
interface SlotSquareProps {
  slot: ItemSlot;
  item: Item | null;
  /** True while a compatible item is being dragged. */
  armed?: boolean;
  onDrop: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onItemClick?: () => void;
  onItemDragStart?: (e: DragEvent) => void;
  onItemDragEnd?: () => void;
  itemDragPayload?: string;
}

export function SlotSquare({
  slot,
  item,
  armed,
  onDrop,
  onDragOver,
  onItemClick,
  onItemDragStart,
  onItemDragEnd,
  itemDragPayload = '',
}: SlotSquareProps) {
  const { t } = useT();
  return (
    <div
      className={`slot-square${armed ? ' armed' : ''}`}
      title={t(`slot.${slot}`)}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {item ? (
        <ItemSquare
          item={item}
          size="slot"
          dragPayload={itemDragPayload}
          onClick={onItemClick}
          onDragStart={onItemDragStart}
          onDragEnd={onItemDragEnd}
        />
      ) : (
        <span className="slot-ghost" aria-hidden>
          {GLYPH[slot]}
        </span>
      )}
    </div>
  );
}
