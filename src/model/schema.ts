import { z } from 'zod'
import { COLORS, type BackupFile, type MapNode, type Maps, type MindMap, type Nodes, type Viewport } from './types'
import { isAncestorOrSelf, newId } from './tree'

const num = z.number().finite()

const nodeSchema = z.object({
  id: z.string().min(1),
  mapId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  order: num,
  title: z.string().max(5000),
  note: z.string().max(100_000),
  color: z.enum(COLORS).nullable(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  x: num,
  y: num,
  collapsed: z.boolean(),
  createdAt: num,
  updatedAt: num,
})

const mapSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(500),
  showNotes: z.boolean(),
  createdAt: num,
  updatedAt: num,
})

const viewportSchema = z.object({ x: num, y: num, k: num.positive() })

const backupSchema = z.object({
  app: z.literal('nous'),
  version: z.literal(1),
  exportedAt: num,
  maps: z.array(mapSchema),
  nodes: z.array(nodeSchema),
  viewports: z.record(z.string(), viewportSchema).optional(),
})

export function makeBackup(maps: Maps, nodes: Nodes, viewports: Record<string, Viewport>): BackupFile {
  return {
    app: 'nous',
    version: 1,
    exportedAt: Date.now(),
    maps: Object.values(maps),
    nodes: Object.values(nodes),
    viewports,
  }
}

export type ParseResult = { ok: true; data: BackupFile } | { ok: false; error: string }

/** Waliduje plik kopii i naprawia drobne niespójności (sieroty, cykle, węzły bez mapy). */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'To nie jest poprawny plik JSON.' }
  }
  const res = backupSchema.safeParse(raw)
  if (!res.success) {
    const first = res.error.issues[0]
    const where = first?.path.join('.') || 'plik'
    return { ok: false, error: `Plik nie wygląda na kopię Nous (${where}: ${first?.message ?? 'błąd'}).` }
  }
  const data = res.data as BackupFile
  const mapIds = new Set(data.maps.map((m) => m.id))
  const byId: Nodes = {}
  for (const n of data.nodes) if (mapIds.has(n.mapId)) byId[n.id] = n
  for (const n of Object.values(byId)) {
    const p = n.parentId ? byId[n.parentId] : null
    // sierota albo rodzic z innej mapy → punkt centralny
    if (n.parentId && (!p || p.mapId !== n.mapId)) byId[n.id] = { ...n, parentId: null }
  }
  for (const n of Object.values(byId)) {
    if (n.parentId && isAncestorOrSelf(byId, n.id, n.parentId)) byId[n.id] = { ...byId[n.id], parentId: null }
  }
  return { ok: true, data: { ...data, nodes: Object.values(byId) } }
}

export function summarize(data: BackupFile) {
  return { maps: data.maps.length, nodes: data.nodes.length }
}

/**
 * Dołącza kopię do istniejących danych. Wszystkie identyfikatory dostają nowe wartości,
 * więc import tego samego pliku dwa razy nie nadpisze niczego.
 */
export function mergeBackup(
  maps: Maps,
  nodes: Nodes,
  viewports: Record<string, Viewport>,
  data: BackupFile,
): { maps: Maps; nodes: Nodes; viewports: Record<string, Viewport>; firstMapId: string | null } {
  const mapIdMap = new Map<string, string>()
  const nodeIdMap = new Map<string, string>()
  const outMaps = { ...maps }
  const outNodes = { ...nodes }
  const outVp = { ...viewports }
  const titles = new Set(Object.values(maps).map((m) => m.title))
  for (const m of data.maps) {
    const id = newId()
    mapIdMap.set(m.id, id)
    const title = titles.has(m.title) ? `${m.title} (import)` : m.title
    outMaps[id] = { ...m, id, title } satisfies MindMap
    if (data.viewports?.[m.id]) outVp[id] = data.viewports[m.id]
  }
  for (const n of data.nodes) nodeIdMap.set(n.id, newId())
  for (const n of data.nodes) {
    const id = nodeIdMap.get(n.id)!
    outNodes[id] = {
      ...n,
      id,
      mapId: mapIdMap.get(n.mapId)!,
      parentId: n.parentId ? (nodeIdMap.get(n.parentId) ?? null) : null,
    } satisfies MapNode
  }
  return { maps: outMaps, nodes: outNodes, viewports: outVp, firstMapId: mapIdMap.get(data.maps[0]?.id) ?? null }
}

/** Zastępuje wszystko zawartością kopii (identyfikatory zostają). */
export function replaceWithBackup(data: BackupFile) {
  const maps: Maps = {}
  const nodes: Nodes = {}
  for (const m of data.maps) maps[m.id] = m
  for (const n of data.nodes) nodes[n.id] = n
  return { maps, nodes, viewports: data.viewports ?? {}, firstMapId: data.maps[0]?.id ?? null }
}
