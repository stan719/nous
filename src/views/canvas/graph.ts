import { childIndex, hiddenIds } from '../../model/tree'
import type { Color, MapNode, Nodes } from '../../model/types'

export interface VisibleNode {
  node: MapNode
  depth: number
  label: string | null
  color: Color | null
  childCount: number
  /** liczba ukrytych potomków, gdy węzeł jest zwinięty */
  hiddenCount: number
}

/** Wszystko, czego potrzebuje renderer mapy, policzone jednym przejściem po drzewie. */
export function visibleGraph(nodes: Nodes, mapId: string): VisibleNode[] {
  const idx = childIndex(nodes, mapId)
  const hidden = hiddenIds(nodes, mapId)
  const out: VisibleNode[] = []
  const countAll = (id: string): number => (idx.get(id) ?? []).reduce((s, c) => s + 1 + countAll(c.id), 0)

  const walk = (parentId: string | null, depth: number, color: Color | null) => {
    ;(idx.get(parentId) ?? []).forEach((n, i) => {
      const c = n.color ?? color
      if (!hidden.has(n.id)) {
        const kids = idx.get(n.id) ?? []
        out.push({
          node: n,
          depth,
          label: depth === 0 ? `Centrum ${i + 1}` : depth === 1 ? `Gałąź ${i + 1}` : null,
          color: c,
          childCount: kids.length,
          hiddenCount: n.collapsed ? countAll(n.id) : 0,
        })
      }
      walk(n.id, depth + 1, c)
    })
  }
  walk(null, 0, null)
  return out
}
