/** Tiny blocky icons drawn as crisp SVG rect-grids (12x12). currentColor. */

type Rect = [number, number, number, number];

const SHAPES: Record<string, Rect[]> = {
  // meta branches
  sword: [
    [8, 1, 3, 3], [7, 4, 2, 2], [6, 5, 2, 2], [5, 6, 2, 2],
    [3, 7, 5, 2], [2, 9, 2, 2], [1, 10, 2, 2], [4, 9, 4, 1],
  ],
  shield: [[3, 1, 6, 1], [2, 2, 8, 3], [3, 5, 6, 3], [4, 8, 4, 2], [5, 10, 2, 1]],
  coin: [
    [4, 1, 4, 1], [2, 2, 2, 2], [8, 2, 2, 2], [1, 4, 2, 4], [9, 4, 2, 4],
    [2, 8, 2, 2], [8, 8, 2, 2], [4, 10, 4, 1], [5, 4, 2, 4],
  ],
  gear: [
    [5, 0, 2, 2], [5, 10, 2, 2], [0, 5, 2, 2], [10, 5, 2, 2],
    [2, 2, 2, 2], [8, 2, 2, 2], [2, 8, 2, 2], [8, 8, 2, 2],
    [4, 3, 4, 6], [3, 4, 6, 4],
  ],
  // skills
  spark: [[5, 0, 2, 4], [5, 8, 2, 4], [0, 5, 4, 2], [8, 5, 4, 2], [4, 4, 4, 4], [3, 3, 1, 1], [8, 8, 1, 1], [8, 3, 1, 1], [3, 8, 1, 1]],
  cross: [[5, 1, 2, 10], [1, 5, 10, 2]],
  // states
  lock: [[3, 5, 6, 6], [4, 2, 4, 1], [3, 3, 1, 3], [8, 3, 1, 3], [5, 7, 2, 2]],
};

export function PixelGlyph({
  shape,
  size = 20,
  color,
  dim,
}: {
  shape: keyof typeof SHAPES | string;
  size?: number;
  color?: string;
  dim?: boolean;
}) {
  const rects = SHAPES[shape] ?? SHAPES.spark;
  return (
    <svg
      className="pixel-icon"
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden
      style={{ color, opacity: dim ? 0.35 : 1 }}
    >
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </svg>
  );
}
