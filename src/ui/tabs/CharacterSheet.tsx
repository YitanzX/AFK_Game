import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import { CLASSES } from '../../game/content/classes';
import { deriveUnitStats } from '../../game/systems/stats';
import { xpForLevel } from '../../game/core/formulas';
import type { Item, ItemSlot } from '../../game/core/items';
import { ITEM_SLOTS, itemValue } from '../../game/core/items';
import type { Stats } from '../../game/core/types';
import { StatList } from '../components/StatList';
import { ItemCard, itemName } from '../components/ItemCard';
import { Bar } from '../components/Bar';
import { formatNumber } from '../format';

const DELTA_KEYS: (keyof Stats)[] = ['maxHp', 'atk', 'def', 'critChance', 'attackSpeed'];

function shortDelta(key: keyof Stats, v: number): string {
  const sign = v > 0 ? '+' : '−';
  const a = Math.abs(v);
  if (key === 'critChance') return `${sign}${(a * 100).toFixed(1)}%`;
  if (key === 'attackSpeed') return `${sign}${a.toFixed(2)}`;
  return `${sign}${formatNumber(Math.round(a))}`;
}

export function CharacterSheet({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { t } = useT();
  const roster = useGameStore((s) => s.roster);
  const inventory = useGameStore((s) => s.inventory);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipItem = useGameStore((s) => s.unequipItem);

  const unit = roster.find((r) => r.classId === classId);
  const [openSlot, setOpenSlot] = useState<ItemSlot | null>(null);

  const stats = useMemo(() => (unit ? deriveUnitStats(unit) : null), [unit]);
  if (!unit || !stats) return null;

  const cls = CLASSES[classId];
  const xpNeeded = xpForLevel(unit.level);

  const previewFor = (slot: ItemSlot, candidate: Item): Stats =>
    deriveUnitStats({ ...unit, equipment: { ...unit.equipment, [slot]: candidate } });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{t(cls?.nameKey ?? classId)}</h2>
          <span className="muted">{t('party.level', { n: unit.level })}</span>
          <div className="spacer" />
          <button onClick={onClose}>{t('sheet.close')}</button>
        </div>

        <div className="bar-label">
          <span>{t('party.xp')}</span>
          <span className="mono">
            {formatNumber(unit.xp)} / {formatNumber(xpNeeded)}
          </span>
        </div>
        <Bar ratio={unit.xp / xpNeeded} kind="xp" />

        <div className="sheet-grid">
          <section>
            <h3>{t('sheet.stats')}</h3>
            <StatList stats={stats} />
          </section>

          <section>
            <h3>{t('sheet.equipment')}</h3>
            {ITEM_SLOTS.map((slot) => {
              const equipped = unit.equipment[slot];
              const candidates = inventory.filter((i) => i.slot === slot);
              const open = openSlot === slot;
              return (
                <div key={slot} className="equip-slot">
                  <button
                    className="equip-slot-head"
                    onClick={() => setOpenSlot(open ? null : slot)}
                  >
                    <span className="muted">{t(`slot.${slot}`)}</span>
                    <span>{equipped ? itemName(equipped, t) : t('sheet.emptySlot')}</span>
                    <span className="muted">{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div className="equip-slot-body">
                      {equipped && (
                        <ItemCard item={equipped}>
                          <button onClick={() => unequipItem(classId, slot)}>
                            {t('sheet.unequip')}
                          </button>
                        </ItemCard>
                      )}

                      {candidates.length === 0 && !equipped && (
                        <p className="muted">{t('sheet.none')}</p>
                      )}

                      {candidates.map((item) => {
                        const preview = previewFor(slot, item);
                        return (
                          <ItemCard key={item.id} item={item}>
                            <div className="delta-row">
                              {DELTA_KEYS.map((k) => {
                                const d = preview[k] - stats[k];
                                if (Math.abs(d) < 1e-6) return null;
                                return (
                                  <span key={k} className={d > 0 ? 'delta up' : 'delta down'}>
                                    {shortDelta(k, d)} {t(`stat.${k}`)}
                                  </span>
                                );
                              })}
                            </div>
                            <button className="primary" onClick={() => equipItem(classId, item.id)}>
                              {t('sheet.equip')}
                            </button>
                            <span className="muted mono" style={{ marginLeft: 8 }}>
                              {formatNumber(itemValue(item))}g
                            </span>
                          </ItemCard>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
