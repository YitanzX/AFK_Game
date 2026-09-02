import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { battleController } from '../game/state/battleController';
import type { LogEntry } from '../game/core/types';

/** i18n keys nested inside a log entry's vars that must be resolved first. */
const NESTED = ['caster', 'skill', 'name', 'target'] as const;

function resolveVars(
  vars: LogEntry['vars'],
  t: (k: string, v?: Record<string, string | number>) => string,
) {
  if (!vars) return undefined;
  const out: Record<string, string | number> = { ...vars };
  for (const k of NESTED) {
    const v = out[k];
    if (typeof v === 'string' && v.includes('.')) out[k] = t(v);
  }
  return out;
}

export function CombatLog() {
  const { t } = useT();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const id = setInterval(() => {
      setEntries([...battleController.getCombat().log]);
    }, 250);
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <section className="panel combat-log">
      <h2 style={{ margin: '0 0 6px', fontSize: 13 }}>{t('log.title')}</h2>
      <div
        ref={boxRef}
        className="log-box"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {entries.map((e) => (
          <div key={e.id} className={`log-line ${e.kind}`}>
            {t(e.key, resolveVars(e.vars, t))}
          </div>
        ))}
      </div>
    </section>
  );
}
