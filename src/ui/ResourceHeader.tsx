import { useT } from '../i18n';
import { useGameStore } from '../game/state/store';
import { formatNumber } from './format';
import { LanguageSwitcher } from './LanguageSwitcher';

export function ResourceHeader() {
  const { t } = useT();
  const gold = useGameStore((s) => s.gold);
  const farmingStage = useGameStore((s) => s.farmingStage);
  const maxStageCleared = useGameStore((s) => s.maxStageCleared);
  const attempt = useGameStore((s) => s.stageAttempt);
  const totalKills = useGameStore((s) => s.totalKills);

  return (
    <header className="panel header">
      <div>
        <h1>{t('app.title')}</h1>
        <div className="sub muted">{t('app.subtitle')}</div>
      </div>

      <div className="stat">
        <span className="label">{t('resource.gold')}</span>
        <span className="value gold mono">{formatNumber(gold)}</span>
      </div>

      <div className="stat">
        <span className="label">{t('resource.stage')}</span>
        <span className="value mono">
          {farmingStage}
          <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
            {t('resource.attempt', { n: attempt })}
          </span>
        </span>
      </div>

      <div className="stat">
        <span className="label">{t('resource.best')}</span>
        <span className="value mono">{maxStageCleared}</span>
      </div>

      <div className="stat">
        <span className="label">{t('resource.kills')}</span>
        <span className="value mono">{formatNumber(totalKills)}</span>
      </div>

      <div className="spacer" />
      <LanguageSwitcher />
    </header>
  );
}
