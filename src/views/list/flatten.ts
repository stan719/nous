import { childIndex, effectiveColor } from '../../model/tree'
import type { Color, MapNode, Nodes } from '../../model/types'

export interface FlatItem {
  id: string
  node: MapNode
  parentId: string | null
  depth: number
  /** pozycja wśród rodzeństwa */
  index: number
  childCount: number
  color: Color | null
}

export const INDENT = 22

/** Drzewo mapy jako płaska lista w kolejności czytania (bez potomków zwiniętych gałęzi). */
export function flatten(nodes: Nodes, mapId: string, skipChildrenOf?: string | null): FlatItem[] {
  const idx = childIndex(nodes, mapId)
  const out: FlatItem[] = []
  const walk = (parentId: string | null, depth: number) => {
    ;(idx.get(parentId) ?? []).forEach((n, index) => {
      const kids = idx.get(n.id) ?? []
      out.push({ id: n.id, node: n, parentId, depth, index, childCount: kids.length, color: effectiveColor(nodes, n.id) })
      if (!n.collapsed && n.id !== skipChildrenOf) walk(n.id, depth + 1)
    })
  }
  walk(null, 0)
  return out
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export interface Projection {
  depth: number
  parentId: string | null
  /** indeks wśród nowego rodzeństwa */
  index: number
}

/**
 * Gdzie wyląduje przeciągany element: pozycja z listy, głębokość z przesunięcia w poziomie
 * (wzorzec „sortable tree” z dnd-kit). Głębokość 0 = punkt centralny.
 */
export function getProjection(items: FlatItem[], activeId: string, overId: string, offsetX: number): Projection | null {
  const overIndex = items.findIndex((i) => i.id === overId)
  const activeIndex = items.findIndex((i) => i.id === activeId)
  if (overIndex < 0 || activeIndex < 0) return null
  const active = items[activeIndex]
  const moved = arrayMove(items, activeIndex, overIndex)
  const prev = moved[overIndex - 1]
  const next = moved[overIndex + 1]
  const projected = active.depth + Math.round(offsetX / INDENT)
  const maxDepth = prev ? prev.depth + 1 : 0
  const minDepth = next ? next.depth : 0
  const depth = Math.min(maxDepth, Math.max(minDepth, projected))

  let parentId: string | null = null
  if (depth > 0 && prev) {
    if (depth === prev.depth) parentId = prev.parentId
    else if (depth > prev.depth) parentId = prev.id
    else parentId = moved.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null
  }
  const index = moved.slice(0, overIndex).filter((i) => i.parentId === parentId && i.id !== activeId && i.depth === depth).length
  return { depth, parentId, index }
}
