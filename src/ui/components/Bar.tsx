interface BarProps {
  /** 0..1 fill ratio. */
  ratio: number;
  kind: 'hp' | 'xp';
}

/** A simple horizontal fill bar. Fill is scaled via transform for cheap animation. */
export function Bar({ ratio, kind }: BarProps) {
  const clamped = Math.max(0, Math.min(1, ratio || 0));
  return (
    <div className={`bar ${kind}`}>
      <span style={{ transform: `scaleX(${clamped})` }} />
    </div>
  );
}
