import type { MapNode, Nodes } from './types'

/** Przybliżony rozmiar węzła do wykrywania kolizji (karty z notatką bywają wyższe). */
const BOX_W = 230
const BOX_H = 120

const mapOf = (nodes: Nodes, mapId: string) => Object.values(nodes).filter((n) => n.mapId === mapId)

function collides(others: MapNode[], x: number, y: number): boolean {
  return others.some((o) => Math.abs(o.x - x) < BOX_W && Math.abs(o.y - y) < BOX_H)
}

const rad = (deg: number) => (deg * Math.PI) / 180
/** Math.round bez „-0” (ważne przy eksporcie/porównaniach) */
const round = (v: number) => Math.round(v) || 0
const angleDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

/** Pozycja dla nowego dziecka: wachlarzem w kierunku „od dziadka”, bez nachodzenia na inne węzły. */
export function placeChild(nodes: Nodes, parentId: string): { x: number; y: number } {
  const p = nodes[parentId]
  if (!p) return { x: 0, y: 0 }
  const others = mapOf(nodes, p.mapId)
  const kids = others.filter((n) => n.parentId === parentId)
  const kidAngles = kids.map((k) => (Math.atan2(k.y - p.y, k.x - p.x) * 180) / Math.PI)

  // kolejne próby: [kąt, promień] — najpierw wachlarz „od rodzica”, potem dalej, a na końcu szersze kąty
  const tries: [number, number][] = []
  if (p.parentId === null) {
    // punkt centralny: rozkładaj dzieci dookoła, zaczynając od dołu
    const score = (a: number) => (kidAngles.length ? Math.min(...kidAngles.map((k) => angleDiff(a, k))) : 180)
    const angles = Array.from({ length: 12 }, (_, i) => 90 + i * 30).sort(
      (a, b) => score(b) - score(a) || angleDiff(a, 90) - angleDiff(b, 90),
    )
    for (let r = 210; r <= 690; r += 120) for (const a of angles) tries.push([a, r])
  } else {
    const gp = nodes[p.parentId]
    const base = gp ? (Math.atan2(p.y - gp.y, p.x - gp.x) * 180) / Math.PI : 90
    for (let r = 180; r <= 540; r += 90) for (const d of [0, 35, -35, 70, -70]) tries.push([base + d, r])
    for (let r = 180; r <= 540; r += 90) for (const d of [105, -105]) tries.push([base + d, r])
  }

  for (const [a, r] of tries) {
    const x = round(p.x + Math.cos(rad(a)) * r)
    const y = round(p.y + Math.sin(rad(a)) * r)
    if (!collides(others, x, y)) return { x, y }
  }
  const [a, r] = tries[0]
  return { x: round(p.x + Math.cos(rad(a)) * r), y: round(p.y + Math.sin(rad(a)) * r) }
}

/** Miejsce na nowy punkt centralny obok (x, y) — szuka wolnego miejsca po spirali. */
export function placeRootNear(nodes: Nodes, mapId: string, x: number, y: number): { x: number; y: number } {
  const others = mapOf(nodes, mapId)
  for (let r = 420; r <= 2000; r += 140) {
    for (let a = 90; a < 450; a += 45) {
      const px = round(x + Math.cos(rad(a)) * r)
      const py = round(y + Math.sin(rad(a)) * r)
      if (!collides(others, px, py) && !others.some((o) => Math.hypot(o.x - px, o.y - py) < 260)) return { x: px, y: py }
    }
  }
  return { x, y: y + 600 }
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsOf(list: MapNode[]): Bounds | null {
  if (!list.length) return null
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const n of list) {
    b.minX = Math.min(b.minX, n.x - BOX_W / 2)
    b.maxX = Math.max(b.maxX, n.x + BOX_W / 2)
    b.minY = Math.min(b.minY, n.y - BOX_H / 2)
    b.maxY = Math.max(b.maxY, n.y + BOX_H / 2)
  }
  return b
}

const SLOT_W = 240
const LEVEL_H = 175

/**
 * „Uporządkuj”: drzewo z góry na dół pod punktem centralnym.
 * Punkt centralny zostaje w miejscu, liście dostają równe sloty.
 */
export function tidy(nodes: Nodes, rootId: string): Nodes {
  const root = nodes[rootId]
  if (!root) return nodes
  const kids = new Map<string, MapNode[]>()
  for (const n of Object.values(nodes)) {
    if (n.mapId !== root.mapId || !n.parentId) continue
    const l = kids.get(n.parentId)
    if (l) l.push(n)
    else kids.set(n.parentId, [n])
  }
  for (const l of kids.values()) l.sort((a, b) => a.order - b.order)

  const leaves = new Map<string, number>()
  const count = (id: string): number => {
    const c = kids.get(id) ?? []
    const v = c.length ? c.reduce((s, k) => s + count(k.id), 0) : 1
    leaves.set(id, v)
    return v
  }
  count(rootId)

  const out = { ...nodes }
  const place = (id: string, left: number, depth: number) => {
    const c = kids.get(id) ?? []
    let cursor = left
    for (const k of c) {
      const w = leaves.get(k.id)! * SLOT_W
      out[k.id] = { ...out[k.id], x: round(cursor + w / 2), y: root.y + depth * LEVEL_H }
      place(k.id, cursor, depth + 1)
      cursor += w
    }
  }
  const total = leaves.get(rootId)! * SLOT_W
  place(rootId, root.x - total / 2, 1)
  return out
}
