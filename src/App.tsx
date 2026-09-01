import { useEffect } from 'react';
import { useGameStore } from './game/state/store';
import { writeSaveNow } from './game/state/persistence';
import { useT } from './i18n';
import { ResourceHeader } from './ui/ResourceHeader';
import { Layout } from './ui/Layout';
import { OfflineModal } from './ui/OfflineModal';

export function App() {
  const { t } = useT();
  const ready = useGameStore((s) => s.ready);
  const init = useGameStore((s) => s.init);

  useEffect(() => {
    init();

    const flush = () => writeSaveNow(useGameStore.getState().snapshotSave());
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);

    // Safety-net periodic write in case the loop's throttled writes stall.
    const id = setInterval(flush, 15000);

    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(id);
      flush();
    };
  }, [init]);

  if (!ready) {
    return <div className="app">{t('app.title')}…</div>;
  }

  return (
    <div className="app">
      <ResourceHeader />
      <Layout />
      <OfflineModal />
    </div>
  );
}
