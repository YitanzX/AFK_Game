import { useEffect, useRef, useState } from 'react';
import { battleController } from '../game/state/battleController';
import type { CombatState } from '../game/core/types';
import { getStage } from '../game/content/stages';
import { CombatScene } from './combat/scene';
import { useT } from '../i18n';

export function CombatCanvas() {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState({
    wave: 0,
    total: 0,
    isBoss: false,
    outcome: 'ongoing' as CombatState['outcome'],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    battleController.start();
    const scene = new CombatScene();

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let lastInfo = '';

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const combat = battleController.getCombat();
      scene.update(combat, dt, canvas.width, canvas.height);
      scene.render(ctx, canvas.width, canvas.height, combat);

      const wave = getStage(combat.stage).waves[combat.wave - 1];
      const key = `${combat.wave}/${combat.totalWaves}/${wave?.isBoss}/${combat.outcome}`;
      if (key !== lastInfo) {
        lastInfo = key;
        setInfo({
          wave: combat.wave,
          total: combat.totalWaves,
          isBoss: !!wave?.isBoss,
          outcome: combat.outcome,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      battleController.stop();
    };
  }, []);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} />
      <div className="wave-pill">
        {t('battle.wave', { current: info.wave, total: info.total })}
        {info.isBoss && <span className="boss">{t('battle.boss')}</span>}
      </div>
      {info.outcome === 'victory' && <div className="banner victory">{t('battle.victory')}</div>}
      {info.outcome === 'defeat' && <div className="banner defeat">{t('battle.defeat')}</div>}
    </div>
  );
}
