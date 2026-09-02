import type { DragEvent } from 'react';
import type { Item, ItemSlot } from '../../game/core/items';
import { useT } from '../../i18n';
import { RARITY_COLOR, formatAffix, itemName } from './ItemCard';

/** Blocky pixel icon per equipment slot, drawn as crisp SVG rects. */
const ICON_RECTS: Record<ItemSlot, [number, number, number, number][]> = {
  // 12x12 grid. sword: blade up-right, guard, grip
  weapon: [
    [8, 1, 3, 3], [7, 4, 3, 2], [6, 5, 2, 2], [5, 6, 2, 2],
    [3, 7, 5, 2], [2, 9, 2, 2], [1, 10, 2, 2], [4, 9, 4, 1],
  ],
  // shield
  armor: [
    [3, 1, 6, 1], [2, 2, 8, 3], [3, 5, 6, 3], [4, 8, 4, 2], [5, 10, 2, 1],
  ],
  // ring
  accessory: [
    [4, 1, 4, 1], [3, 2, 2, 2], [7, 2, 2, 2], [2, 4, 2, 4], [8, 4, 2, 4],
    [3, 8, 2, 2], [7, 8, 2, 2], [4, 10, 4, 1], [5, 2, 2, 1],
  ],
};

export function PixelSlotIcon({ slot, dim }: { slot: ItemSlot; dim?: boolean }) {
  return (
    <svg
      className="pixel-icon"
      viewBox="0 0 12 12"
      width="22"
      height="22"
      shapeRendering="crispEdges"
      aria-hidden
      style={dim ? { opacity: 0.3 } : undefined}
    >
      {ICON_RECTS[slot].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </svg>
  );
}

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
      <span className="sq-glyph" style={{ color }}>
        <PixelSlotIcon slot={item.slot} />
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
        <span className="slot-ghost">
          <PixelSlotIcon slot={slot} dim />
        </span>
      )}
    </div>
  );
}
