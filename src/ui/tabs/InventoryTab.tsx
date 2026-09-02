import { useState, type DragEvent } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import { CLASSES } from '../../game/content/classes';
import type { Item, ItemSlot } from '../../game/core/items';
import { ITEM_SLOTS, itemScore, itemValue } from '../../game/core/items';
import { formatAffix, itemName } from '../components/ItemCard';
import { ItemSquare, SlotSquare } from '../components/ItemSquare';
import { formatNumber } from '../format';

interface Dragged {
  item: Item;
  from?: { classId: string; slot: ItemSlot };
}

export function InventoryTab() {
  const { t } = useT();
  const inventory = useGameStore((s) => s.inventory);
  const roster = useGameStore((s) => s.roster);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipItem = useGameStore((s) => s.unequipItem);
  const sellItem = useGameStore((s) => s.sellItem);
  const sellItems = useGameStore((s) => s.sellItems);

  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...inventory].sort((a, b) => itemScore(b) - itemScore(a));
  const selected = inventory.find((i) => i.id === selectedId) ?? null;
  const commons = inventory.filter((i) => i.rarity === 'common').length;
  const emptyCells = Math.max(0, Math.max(30, Math.ceil((sorted.length + 1) / 6) * 6) - sorted.length);

  // --- drop handlers -------------------------------------------------
  const onSlotDragOver = (slot: ItemSlot) => (e: DragEvent) => {
    if (dragged && dragged.item.slot === slot) e.preventDefault();
  };

  const onSlotDrop = (classId: string, slot: ItemSlot) => (e: DragEvent) => {
    e.preventDefault();
    if (!dragged || dragged.item.slot !== slot) return;
    if (dragged.from) {
      if (dragged.from.classId === classId) return; // dropped back on itself
      unequipItem(dragged.from.classId, dragged.from.slot);
    }
    equipItem(classId, dragged.item.id);
    setDragged(null);
  };

  const onGridDragOver = (e: DragEvent) => {
    if (dragged?.from) e.preventDefault();
  };
  const onGridDrop = (e: DragEvent) => {
    e.preventDefault();
    if (dragged?.from) unequipItem(dragged.from.classId, dragged.from.slot);
    setDragged(null);
  };

  return (
    <div className="panel tab-scroll">
      <div className="row">
        <h3 style={{ margin: 0 }}>{t('inventory.title')}</h3>
        <span className="muted">{t('inventory.count', { n: inventory.length })}</span>
        <div className="spacer" />
        <button disabled={commons === 0} onClick={() => sellItems((i) => i.rarity === 'common')}>
          {t('inventory.sellCommons')}
        </button>
      </div>

      <p className="muted inv-hint">{t('inventory.dragHint')}</p>

      {/* party equipment slots */}
      <div className="equip-heroes">
        {roster.map((hero) => (
          <div key={hero.classId} className="equip-hero">
            <div className="equip-hero-name">{t(CLASSES[hero.classId]?.nameKey ?? hero.classId)}</div>
            <div className="equip-hero-slots">
              {ITEM_SLOTS.map((slot) => {
                const it = hero.equipment[slot];
                return (
                  <SlotSquare
                    key={slot}
                    slot={slot}
                    item={it}
                    armed={!!dragged && dragged.item.slot === slot}
                    onDragOver={onSlotDragOver(slot)}
                    onDrop={onSlotDrop(hero.classId, slot)}
                    itemDragPayload={`eq:${hero.classId}:${slot}`}
                    onItemClick={() => it && setSelectedId(it.id)}
                    onItemDragStart={() =>
                      it && setDragged({ item: it, from: { classId: hero.classId, slot } })
                    }
                    onItemDragEnd={() => setDragged(null)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* inventory grid */}
      {inventory.length === 0 ? (
        <p className="muted">{t('inventory.empty')}</p>
      ) : (
        <div className="inv-grid" onDragOver={onGridDragOver} onDrop={onGridDrop}>
          {sorted.map((item) => (
            <ItemSquare
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              dragPayload={`inv:${item.id}`}
              onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
              onDragStart={() => setDragged({ item })}
              onDragEnd={() => setDragged(null)}
            />
          ))}
          {Array.from({ length: emptyCells }).map((_, i) => (
            <div key={`e${i}`} className="item-square empty" />
          ))}
        </div>
      )}

      {/* selected item detail */}
      {selected && (
        <div className="inv-detail">
          <div className="inv-detail-main">
            <strong>{itemName(selected, t)}</strong> <span className="muted">i{selected.ilvl}</span>
            <ul className="affixes">
              {selected.affixes.map((a, i) => (
                <li key={i}>{formatAffix(a, t)}</li>
              ))}
            </ul>
          </div>
          <div className="inv-detail-actions">
            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {t('inventory.equipOn')}
              </span>
              {roster.map((hero) => (
                <button
                  key={hero.classId}
                  onClick={() => equipItem(hero.classId, selected.id)}
                >
                  {t(CLASSES[hero.classId]?.nameKey ?? hero.classId)}
                </button>
              ))}
            </div>
            <button
              className="primary"
              onClick={() => {
                sellItem(selected.id);
                setSelectedId(null);
              }}
            >
              {t('inventory.sell', { n: formatNumber(itemValue(selected)) })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
