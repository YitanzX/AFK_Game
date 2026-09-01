import { useT } from '../../i18n';
import { useGameStore } from '../../game/state/store';
import { CLASSES } from '../../game/content/classes';
import { itemScore, itemValue } from '../../game/core/items';
import { ItemCard } from '../components/ItemCard';
import { formatNumber } from '../format';

export function InventoryTab() {
  const { t } = useT();
  const inventory = useGameStore((s) => s.inventory);
  const roster = useGameStore((s) => s.roster);
  const equipItem = useGameStore((s) => s.equipItem);
  const sellItem = useGameStore((s) => s.sellItem);
  const sellItems = useGameStore((s) => s.sellItems);

  const sorted = [...inventory].sort((a, b) => itemScore(b) - itemScore(a));
  const commons = inventory.filter((i) => i.rarity === 'common');

  return (
    <div className="panel tab-scroll">
      <div className="row">
        <h3 style={{ margin: 0 }}>{t('inventory.title')}</h3>
        <span className="muted">{t('inventory.count', { n: inventory.length })}</span>
        <div className="spacer" />
        <button
          disabled={commons.length === 0}
          onClick={() => sellItems((i) => i.rarity === 'common')}
        >
          {t('inventory.sellCommons')}
        </button>
      </div>

      {inventory.length === 0 ? (
        <p className="muted">{t('inventory.empty')}</p>
      ) : (
        <div className="inv-grid">
          {sorted.map((item) => (
            <ItemCard key={item.id} item={item}>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) equipItem(e.target.value, item.id);
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>
                    {t('inventory.equipOn')}
                  </option>
                  {roster.map((r) => (
                    <option key={r.classId} value={r.classId}>
                      {t(CLASSES[r.classId]?.nameKey ?? r.classId)}
                    </option>
                  ))}
                </select>
                <button onClick={() => sellItem(item.id)}>
                  {t('inventory.sell', { n: formatNumber(itemValue(item)) })}
                </button>
              </div>
            </ItemCard>
          ))}
        </div>
      )}
    </div>
  );
}
