import { memo } from 'react'
import type { VisibleNode } from './graph'

type Pos = (id: string) => { x: number; y: number }

/** Krzywa Béziera od rodzica do dziecka — pionowa albo pozioma, zależnie od układu. */
export function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dy) >= Math.abs(dx) * 0.6) {
    const my = a.y + dy / 2
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`
  }
  const mx = a.x + dx / 2
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`
}

export const Edges = memo(function Edges({ list, pos, drawIn }: { list: VisibleNode[]; pos: Pos; drawIn?: boolean }) {
  return (
    <svg className="edges" aria-hidden="true">
      {list.map(({ node, depth, color }) => {
        if (!node.parentId) return null
        const fromRoot = depth === 1
        return (
          <path
            key={node.id}
            d={edgePath(pos(node.parentId), pos(node.id))}
            stroke={color ? `var(--c-${color})` : 'var(--c-none)'}
            strokeOpacity={fromRoot ? 0.62 : 0.42}
            strokeWidth={fromRoot ? 2.4 : 1.6}
            strokeLinecap="round"
            fill="none"
            // przy otwarciu mapy krawędzie „rysują się” od rodzica do dziecka
            className={drawIn ? 'edge-draw' : undefined}
            pathLength={drawIn ? 1 : undefined}
            style={drawIn ? { animationDelay: `${Math.min(depth, 5) * 70}ms` } : undefined}
          />
        )
      })}
    </svg>
  )
})
