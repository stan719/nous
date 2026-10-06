import { nanoid } from 'nanoid'
import type { Color, MapNode, Nodes } from './types'
import { placeChild, placeRootNear } from './layout'

export const newId = () => nanoid(12)

export interface Added {
  nodes: Nodes
  id: string | null
}

const byOrder = (a: MapNode, b: MapNode) => a.order - b.order || a.createdAt - b.createdAt

export function mapNodes(nodes: Nodes, mapId: string): MapNode[] {
  return Object.values(nodes).filter((n) => n.mapId === mapId)
}

export function childrenOf(nodes: Nodes, parentId: string | null, mapId: string): MapNode[] {
  return Object.values(nodes)
    .filter((n) => n.mapId === mapId && n.parentId === parentId)
    .sort(byOrder)
}

export const rootsOf = (nodes: Nodes, mapId: string) => childrenOf(nodes, null, mapId)

/** Indeks rodzic → dzieci (posortowane), liczony raz dla całej mapy. */
export function childIndex(nodes: Nodes, mapId: string): Map<string | null, MapNode[]> {
  const idx = new Map<string | null, MapNode[]>()
  for (const n of Object.values(nodes)) {
    if (n.mapId !== mapId) continue
    const list = idx.get(n.parentId)
    if (list) list.push(n)
    else idx.set(n.parentId, [n])
  }
  for (const list of idx.values()) list.sort(byOrder)
  return idx
}

export function descendantIds(nodes: Nodes, id: string): string[] {
  const node = nodes[id]
  if (!node) return []
  const idx = childIndex(nodes, node.mapId)
  const out: string[] = []
  const stack = [...(idx.get(id) ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    out.push(n.id)
    stack.push(...(idx.get(n.id) ?? []))
  }
  return out
}

/** Czy `ancestorId` jest przodkiem (lub tym samym węzłem co) `id`. */
export function isAncestorOrSelf(nodes: Nodes, ancestorId: string, id: string): boolean {
  let cur: MapNode | undefined = nodes[id]
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    if (cur.id === ancestorId) return true
    seen.add(cur.id)
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
  return false
}

export function pathOf(nodes: Nodes, id: string): MapNode[] {
  const path: MapNode[] = []
  let cur: MapNode | undefined = nodes[id]
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    path.unshift(cur)
    seen.add(cur.id)
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
  return path
}

export const depthOf = (nodes: Nodes, id: string) => pathOf(nodes, id).length - 1

export function effectiveColor(nodes: Nodes, id: string): Color | null {
  for (const n of pathOf(nodes, id).reverse()) if (n.color) return n.color
  return null
}

/** „Centrum 2” dla punktu centralnego, „Gałąź 3” dla pierwszego poziomu, inaczej null. */
export function nodeLabel(nodes: Nodes, id: string): string | null {
  const n = nodes[id]
  if (!n) return null
  const siblings = childrenOf(nodes, n.parentId, n.mapId)
  const i = siblings.findIndex((s) => s.id === id) + 1
  if (n.parentId === null) return `Centrum ${i}`
  if (nodes[n.parentId]?.parentId === null) return `Gałąź ${i}`
  return null
}

export function createNode(fields: Partial<MapNode> & Pick<MapNode, 'mapId'>): MapNode {
  const now = Date.now()
  return {
    id: newId(),
    parentId: null,
    order: 0,
    title: '',
    note: '',
    color: null,
    priority: 0,
    x: 0,
    y: 0,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
    ...fields,
  }
}

function renumber(nodes: Nodes, ordered: MapNode[]): Nodes {
  let out = nodes
  ordered.forEach((n, i) => {
    if (out[n.id].order !== i) {
      if (out === nodes) out = { ...nodes }
      out[n.id] = { ...out[n.id], order: i }
    }
  })
  return out
}

export function addRoot(nodes: Nodes, mapId: string, x: number, y: number, title = '') {
  const roots = rootsOf(nodes, mapId)
  const node = createNode({ mapId, x, y, title, order: roots.length })
  return { nodes: { ...nodes, [node.id]: node }, id: node.id }
}

export function addChild(nodes: Nodes, parentId: string, title = ''): Added {
  const parent = nodes[parentId]
  if (!parent) return { nodes, id: null }
  const pos = placeChild(nodes, parentId)
  const node = createNode({
    mapId: parent.mapId,
    parentId,
    title,
    order: childrenOf(nodes, parentId, parent.mapId).length,
    // domyślnie kolor gałęzi — można go potem zmienić
    color: effectiveColor(nodes, parentId),
    ...pos,
  })
  // rozwiń rodzica, żeby nowe dziecko było widoczne
  const p = parent.collapsed ? { ...parent, collapsed: false } : parent
  return { nodes: { ...nodes, [parentId]: p, [node.id]: node }, id: node.id }
}

export function addSibling(nodes: Nodes, id: string, title = ''): Added {
  const ref = nodes[id]
  if (!ref) return { nodes, id: null }
  if (ref.parentId === null) {
    const pos = placeRootNear(nodes, ref.mapId, ref.x, ref.y)
    return addRoot(nodes, ref.mapId, pos.x, pos.y, title)
  }
  const added = addChild(nodes, ref.parentId, title)
  if (!added.id) return added
  // wstaw zaraz za węzłem referencyjnym
  const siblings = childrenOf(added.nodes, ref.parentId, ref.mapId).filter((s) => s.id !== added.id)
  const at = siblings.findIndex((s) => s.id === id) + 1
  siblings.splice(at, 0, added.nodes[added.id])
  return { nodes: renumber(added.nodes, siblings), id: added.id }
}

export function updateNode(nodes: Nodes, id: string, patch: Partial<Omit<MapNode, 'id' | 'mapId'>>): Nodes {
  const n = nodes[id]
  if (!n) return nodes
  return { ...nodes, [id]: { ...n, ...patch, updatedAt: Date.now() } }
}

/**
 * Zmienia kolor węzła i podąża za nim w głąb gałęzi: podpunkty, które miały kolor
 * gałęzi (albo żaden), dostają nowy; podpunkty z własnym, innym kolorem zostają.
 */
export function recolorBranch(nodes: Nodes, id: string, color: Color | null): Nodes {
  const n = nodes[id]
  if (!n) return nodes
  const old = effectiveColor(nodes, id)
  const out = { ...nodes, [id]: { ...n, color, updatedAt: Date.now() } }
  const idx = childIndex(nodes, n.mapId)
  const follow = (pid: string) => {
    for (const c of idx.get(pid) ?? []) {
      if (c.color !== null && c.color !== old) continue
      out[c.id] = { ...out[c.id], color }
      follow(c.id)
    }
  }
  if (color !== old) follow(id)
  return out
}

/** Zapisuje odziedziczone kolory jawnie w węzłach (migracja danych sprzed v2). */
export function materializeColors(nodes: Nodes): Nodes {
  let out = nodes
  for (const n of Object.values(nodes)) {
    if (n.color !== null || n.parentId === null) continue
    const c = effectiveColor(nodes, n.id)
    if (c) {
      if (out === nodes) out = { ...nodes }
      out[n.id] = { ...n, color: c }
    }
  }
  return out
}

export function deleteSubtree(nodes: Nodes, id: string): Nodes {
  const n = nodes[id]
  if (!n) return nodes
  const out = { ...nodes }
  for (const d of [id, ...descendantIds(nodes, id)]) delete out[d]
  return renumber(out, childrenOf(out, n.parentId, n.mapId))
}

export function moveSubtree(nodes: Nodes, id: string, dx: number, dy: number): Nodes {
  if (!nodes[id] || (dx === 0 && dy === 0)) return nodes
  const out = { ...nodes }
  for (const d of [id, ...descendantIds(nodes, id)]) {
    out[d] = { ...out[d], x: out[d].x + dx, y: out[d].y + dy }
  }
  out[id] = { ...out[id], updatedAt: Date.now() }
  return out
}

/**
 * Przenosi węzeł (z poddrzewem) pod nowego rodzica na pozycję `index`.
 * Zwraca niezmienione `nodes`, gdy ruch jest niepoprawny (cykl, inna mapa).
 */
export function reparent(nodes: Nodes, id: string, newParentId: string | null, index: number): Nodes {
  const n = nodes[id]
  if (!n) return nodes
  if (newParentId !== null) {
    const np = nodes[newParentId]
    if (!np || np.mapId !== n.mapId || isAncestorOrSelf(nodes, id, newParentId)) return nodes
  }
  let out: Nodes = { ...nodes }
  const oldParentId = n.parentId

  if (oldParentId !== newParentId && newParentId !== null) {
    // przesuń poddrzewo w pobliże nowego rodzica (na kanwie)
    const without = { ...out }
    for (const d of [id, ...descendantIds(out, id)]) delete without[d]
    const pos = placeChild(without, newParentId)
    out = moveSubtree(out, id, pos.x - n.x, pos.y - n.y)
    if (out[newParentId].collapsed) out[newParentId] = { ...out[newParentId], collapsed: false }
  }
  out[id] = { ...out[id], parentId: newParentId, updatedAt: Date.now() }
  // gałąź w kolorze starego rodzica przejmuje kolor nowego
  if (oldParentId !== newParentId && newParentId !== null) {
    const oldColor = oldParentId ? effectiveColor(nodes, oldParentId) : null
    const newColor = effectiveColor(out, newParentId)
    if (newColor && newColor !== oldColor && (n.color === null || n.color === oldColor)) out = recolorBranch(out, id, newColor)
  }

  const siblings = childrenOf(out, newParentId, n.mapId).filter((s) => s.id !== id)
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, out[id])
  out = renumber(out, siblings)
  if (oldParentId !== newParentId) out = renumber(out, childrenOf(out, oldParentId, n.mapId))
  return out
}

/** Wcięcie: węzeł staje się ostatnim dzieckiem poprzedniego rodzeństwa. */
export function indent(nodes: Nodes, id: string): Nodes {
  const n = nodes[id]
  if (!n) return nodes
  const siblings = childrenOf(nodes, n.parentId, n.mapId)
  const i = siblings.findIndex((s) => s.id === id)
  if (i <= 0) return nodes
  const prev = siblings[i - 1]
  return reparent(nodes, id, prev.id, childrenOf(nodes, prev.id, n.mapId).length)
}

/** Cofnięcie wcięcia: węzeł staje się rodzeństwem swojego rodzica (zaraz za nim). */
export function outdent(nodes: Nodes, id: string): Nodes {
  const n = nodes[id]
  if (!n || n.parentId === null) return nodes
  const parent = nodes[n.parentId]
  if (parent.parentId === null) return detachAsRoot(nodes, id)
  const parentSiblings = childrenOf(nodes, parent.parentId, n.mapId)
  const at = parentSiblings.findIndex((s) => s.id === parent.id) + 1
  return reparent(nodes, id, parent.parentId, at)
}

/** Odłącza węzeł z poddrzewem i ustawia go jako nowy punkt centralny (pozycja na kanwie zostaje). */
export function detachAsRoot(nodes: Nodes, id: string): Nodes {
  const n = nodes[id]
  if (!n || n.parentId === null) return nodes
  return reparent(nodes, id, null, rootsOf(nodes, n.mapId).length)
}

export function toggleCollapsed(nodes: Nodes, id: string): Nodes {
  const n = nodes[id]
  if (!n) return nodes
  return { ...nodes, [id]: { ...n, collapsed: !n.collapsed } }
}

/** Węzły ukryte przez zwinięte gałęzie (potomkowie zwiniętego węzła). */
export function hiddenIds(nodes: Nodes, mapId: string): Set<string> {
  const hidden = new Set<string>()
  for (const n of Object.values(nodes)) {
    if (n.mapId === mapId && n.collapsed) for (const d of descendantIds(nodes, n.id)) hidden.add(d)
  }
  return hidden
}
