import { LOCALES, useT } from '../i18n';
import { useGameStore } from '../game/state/store';

export function LanguageSwitcher() {
  const { locale } = useT();
  const setLocale = useGameStore((s) => s.setLocale);

  return (
    <div className="lang" role="group" aria-label="language">
      {LOCALES.map((code) => (
        <button
          key={code}
          className={code === locale ? 'active' : ''}
          onClick={() => setLocale(code)}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
