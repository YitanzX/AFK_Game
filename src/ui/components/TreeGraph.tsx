import { PixelGlyph } from './PixelGlyph';

export type NodeState = 'locked' | 'available' | 'owned' | 'maxed';

export interface GraphNode {
  id: string;
  col: number;
  row: number;
  glyph: string;
  color: string;
  rank: number;
  maxRank: number;
  state: NodeState;
  selected?: boolean;
  title?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  active: boolean;
}

export const CELL_W = 104;
const CELL_H = 92;
const NODE = 60;

function center(n: { col: number; row: number }) {
  return { x: n.col * CELL_W + CELL_W / 2, y: n.row * CELL_H + CELL_H / 2 };
}

export function TreeGraph({
  nodes,
  edges,
  cols,
  rows,
  onSelect,
  embedded,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cols: number;
  rows: number;
  onSelect: (id: string) => void;
  /** true = caller provides the scroll wrapper. */
  embedded?: boolean;
}) {
  const w = cols * CELL_W;
  const h = rows * CELL_H;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const graph = (
    <div className="tree-graph" style={{ width: w, height: h }}>
        <svg className="tree-edges" width={w} height={h} shapeRendering="crispEdges">
          {edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const p = center(a);
            const c = center(b);
            const midY = Math.round((p.y + c.y) / 2);
            return (
              <polyline
                key={i}
                points={`${p.x},${p.y} ${p.x},${midY} ${c.x},${midY} ${c.x},${c.y}`}
                className={`tree-edge${e.active ? ' active' : ''}`}
                fill="none"
              />
            );
          })}
        </svg>

        {nodes.map((n) => {
          const c = center(n);
          return (
            <button
              key={n.id}
              className={`tree-node st-${n.state}${n.selected ? ' selected' : ''}`}
              style={{
                left: c.x - NODE / 2,
                top: c.y - NODE / 2,
                width: NODE,
                height: NODE,
                borderColor: n.state === 'locked' ? undefined : n.color,
              }}
              title={n.title}
              onClick={() => onSelect(n.id)}
            >
              <PixelGlyph
                shape={n.state === 'locked' ? 'lock' : n.glyph}
                size={26}
                color={n.state === 'locked' ? undefined : n.color}
                dim={n.state === 'locked'}
              />
              <span className="tree-node-pips">
                {Array.from({ length: n.maxRank }).map((_, i) => (
                  <span key={i} className={i < n.rank ? 'pip on' : 'pip'} />
                ))}
              </span>
            </button>
          );
        })}
    </div>
  );

  return embedded ? graph : <div className="tree-scroll">{graph}</div>;
}
