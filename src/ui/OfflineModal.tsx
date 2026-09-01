import { useT } from '../i18n';
import { useGameStore } from '../game/state/store';
import { AFK_CAP_SECONDS } from '../game/core/formulas';
import { formatDuration, formatNumber } from './format';

export function OfflineModal() {
  const { t } = useT();
  const summary = useGameStore((s) => s.offlineSummary);
  const dismiss = useGameStore((s) => s.dismissOfflineSummary);
  const farmingStage = useGameStore((s) => s.maxStageCleared);

  if (!summary) return null;

  return (
    <div className="modal-backdrop" onClick={dismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('offline.title')}</h2>
        <p className="muted">
          {t('offline.body', {
            stage: Math.max(1, farmingStage),
            duration: formatDuration(summary.seconds),
          })}{' '}
          {summary.capped && t('offline.capped', { cap: formatDuration(AFK_CAP_SECONDS) })}
        </p>

        <div className="rewards">
          <span className="gold">{t('offline.gold', { n: formatNumber(summary.gold) })}</span>
          <span className="xp">{t('offline.xp', { n: formatNumber(summary.xp) })}</span>
        </div>

        <div className="row">
          <div className="spacer" />
          <button className="primary" onClick={dismiss}>
            {t('offline.claim')}
          </button>
        </div>
      </div>
    </div>
  );
}
