import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { temporal } from 'zundo'
import { placeRootNear, tidy } from '../model/layout'
import { mergeBackup, replaceWithBackup } from '../model/schema'
import * as T from '../model/tree'
import type { BackupFile, MapNode, Maps, MindMap, Nodes, Viewport } from '../model/types'
import { idbStorage } from './idbStorage'
import { seedMap } from './seed'

export type View = 'canvas' | 'list'
export type Sheet =
  | { type: 'preview'; id: string }
  | { type: 'edit'; id: string; isNew?: boolean }
  | { type: 'maps' }
  | { type: 'search' }
  | { type: 'pdf' }
  | null

export interface Toast {
  id: number
  text: string
  undo?: boolean
}

interface Data {
  maps: Maps
  nodes: Nodes
  viewports: Record<string, Viewport>
  currentMapId: string | null
  view: View
  lastExportAt: number | null
}

interface UI {
  hydrated: boolean
  selectedId: string | null
  sheet: Sheet
  toast: Toast | null
  /** Prośba o wycentrowanie widoku na węźle (np. z wyszukiwarki). */
  focusRequest: { id: string; n: number } | null
}

interface Actions {
  // mapy
  newMap: (title?: string) => void
  selectMap: (id: string) => void
  renameMap: (id: string, title: string) => void
  deleteMap: (id: string) => void
  toggleNotes: () => void
  // węzły
  addRootAt: (x: number, y: number) => string | null
  addRoot: () => string | null
  addChild: (parentId: string) => string | null
  addSibling: (id: string) => string | null
  updateNode: (id: string, patch: Partial<Omit<MapNode, 'id' | 'mapId'>>) => void
  removeNode: (id: string) => void
  discardNew: (id: string) => void
  moveNode: (id: string, dx: number, dy: number) => void
  reparent: (id: string, parentId: string | null, index: number) => void
  indent: (id: string) => void
  outdent: (id: string) => void
  detachAsRoot: (id: string) => void
  toggleCollapsed: (id: string) => void
  tidyMap: () => void
  // UI
  select: (id: string | null) => void
  openSheet: (sheet: Sheet) => void
  closeSheet: () => void
  setView: (view: View) => void
  setViewport: (mapId: string, vp: Viewport) => void
  showToast: (text: string, undo?: boolean) => void
  hideToast: () => void
  focusNode: (id: string) => void
  // kopia
  importBackup: (data: BackupFile, mode: 'add' | 'replace') => void
  markExported: () => void
  undo: () => void
  redo: () => void
}

export type NousState = Data & UI & Actions

let toastSeq = 0

export const useNous = create<NousState>()(
  persist(
    temporal(
      (set, get) => {
        /** Zmiana węzłów bieżącej mapy + odświeżenie znacznika czasu mapy. */
        const commitNodes = (nodes: Nodes, extra: Partial<NousState> = {}) => {
          const { currentMapId, maps } = get()
          const map = currentMapId ? maps[currentMapId] : null
          set({
            nodes,
            ...(map ? { maps: { ...maps, [map.id]: { ...map, updatedAt: Date.now() } } } : {}),
            ...extra,
          })
        }
        const created = (res: { nodes: Nodes; id: string | null }) => {
          if (!res.id) return null
          commitNodes(res.nodes, { selectedId: res.id, sheet: { type: 'edit', id: res.id, isNew: true } })
          return res.id
        }

        return {
          maps: {},
          nodes: {},
          viewports: {},
          currentMapId: null,
          view: 'canvas',
          lastExportAt: null,
          hydrated: false,
          selectedId: null,
          sheet: null,
          toast: null,
          focusRequest: null,

          newMap: (title = 'Nowa mapa') => {
            const now = Date.now()
            const map: MindMap = { id: T.newId(), title, showNotes: true, createdAt: now, updatedAt: now }
            const { nodes, id } = T.addRoot(get().nodes, map.id, 0, 0, '')
            set({
              maps: { ...get().maps, [map.id]: map },
              nodes,
              currentMapId: map.id,
              selectedId: id,
              sheet: { type: 'edit', id, isNew: true },
            })
          },
          selectMap: (id) => set({ currentMapId: id, selectedId: null, sheet: null }),
          renameMap: (id, title) => {
            const m = get().maps[id]
            if (m) set({ maps: { ...get().maps, [id]: { ...m, title: title.trim() || 'Bez tytułu', updatedAt: Date.now() } } })
          },
          deleteMap: (id) => {
            const { maps, nodes, viewports, currentMapId } = get()
            const restMaps = { ...maps }
            delete restMaps[id]
            const restNodes: Nodes = {}
            for (const n of Object.values(nodes)) if (n.mapId !== id) restNodes[n.id] = n
            const restVp = { ...viewports }
            delete restVp[id]
            let next = currentMapId === id ? (Object.values(restMaps).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null) : currentMapId
            let outNodes = restNodes
            if (!next) {
              // zawsze zostaje przynajmniej jedna mapa
              const now = Date.now()
              const map: MindMap = { id: T.newId(), title: 'Nowa mapa', showNotes: true, createdAt: now, updatedAt: now }
              restMaps[map.id] = map
              outNodes = T.addRoot(restNodes, map.id, 0, 0, 'Punkt centralny').nodes
              next = map.id
            }
            set({ maps: restMaps, nodes: outNodes, viewports: restVp, currentMapId: next, selectedId: null })
            get().showToast('Usunięto mapę', true)
          },
          toggleNotes: () => {
            const { currentMapId, maps } = get()
            const m = currentMapId ? maps[currentMapId] : null
            if (m) set({ maps: { ...maps, [m.id]: { ...m, showNotes: !m.showNotes } } })
          },

          addRootAt: (x, y) => {
            const mapId = get().currentMapId
            if (!mapId) return null
            return created(T.addRoot(get().nodes, mapId, Math.round(x), Math.round(y), ''))
          },
          addRoot: () => {
            const { currentMapId: mapId, nodes, viewports } = get()
            if (!mapId) return null
            const roots = T.rootsOf(nodes, mapId)
            const vp = viewports[mapId]
            const cx = vp ? (window.innerWidth / 2 - vp.x) / vp.k : 0
            const cy = vp ? (window.innerHeight / 2 - vp.y) / vp.k : 0
            const pos = roots.length ? placeRootNear(nodes, mapId, cx, cy) : { x: 0, y: 0 }
            return created(T.addRoot(nodes, mapId, pos.x, pos.y, ''))
          },
          addChild: (parentId) => created(T.addChild(get().nodes, parentId, '')),
          addSibling: (id) => created(T.addSibling(get().nodes, id, '')),
          updateNode: (id, patch) => {
            const { color, ...rest } = patch
            let nodes = T.updateNode(get().nodes, id, rest)
            // zmiana koloru obejmuje podpunkty w kolorze gałęzi (jedna pozycja w historii)
            if (color !== undefined && color !== nodes[id]?.color) nodes = T.recolorBranch(nodes, id, color)
            commitNodes(nodes)
          },
          removeNode: (id) => {
            const n = get().nodes[id]
            if (!n) return
            const count = T.descendantIds(get().nodes, id).length
            commitNodes(T.deleteSubtree(get().nodes, id), { selectedId: null, sheet: null })
            const name = n.title.trim() ? `„${n.title.trim().slice(0, 28)}${n.title.length > 28 ? '…' : ''}”` : 'myśl'
            get().showToast(count ? `Usunięto ${name} z ${count} podpunktami` : `Usunięto ${name}`, true)
          },
          discardNew: (id) => {
            // nowy, pusty węzeł zamknięty bez treści — cofamy jego utworzenie bez śladu w historii
            const n = get().nodes[id]
            if (!n || n.title.trim() || n.note.trim() || T.descendantIds(get().nodes, id).length) return
            useNous.temporal.getState().undo()
            useNous.temporal.setState({ futureStates: [] })
            if (get().nodes[id]) set({ nodes: T.deleteSubtree(get().nodes, id) })
            set({ selectedId: null, sheet: null })
            fixCurrentMap()
          },
          moveNode: (id, dx, dy) => commitNodes(T.moveSubtree(get().nodes, id, Math.round(dx), Math.round(dy))),
          reparent: (id, parentId, index) => commitNodes(T.reparent(get().nodes, id, parentId, index)),
          indent: (id) => commitNodes(T.indent(get().nodes, id)),
          outdent: (id) => commitNodes(T.outdent(get().nodes, id)),
          detachAsRoot: (id) => commitNodes(T.detachAsRoot(get().nodes, id)),
          toggleCollapsed: (id) => commitNodes(T.toggleCollapsed(get().nodes, id)),
          tidyMap: () => {
            const mapId = get().currentMapId
            if (!mapId) return
            let nodes = get().nodes
            const roots = T.rootsOf(nodes, mapId)
            // układamy centra jedno pod drugim, każde z drzewem pod spodem
            let y = roots[0]?.y ?? 0
            const x = roots[0]?.x ?? 0
            for (const r of roots) {
              nodes = T.moveSubtree(nodes, r.id, x - nodes[r.id].x, y - nodes[r.id].y)
              nodes = tidy(nodes, r.id)
              const depth = Math.max(0, ...T.descendantIds(nodes, r.id).map((d) => nodes[d].y - y))
              y += depth + 380
            }
            commitNodes(nodes)
            get().showToast('Uporządkowano mapę', true)
          },

          select: (id) => set({ selectedId: id }),
          openSheet: (sheet) => set({ sheet }),
          closeSheet: () => set({ sheet: null }),
          setView: (view) => set({ view, sheet: null }),
          setViewport: (mapId, vp) => set({ viewports: { ...get().viewports, [mapId]: vp } }),
          showToast: (text, undo) => set({ toast: { id: ++toastSeq, text, undo } }),
          hideToast: () => set({ toast: null }),
          focusNode: (id) => {
            const n = get().nodes[id]
            if (!n) return
            // odsłoń węzeł, jeśli jest w zwiniętej gałęzi
            let nodes = get().nodes
            for (const p of T.pathOf(nodes, id).slice(0, -1)) if (p.collapsed) nodes = { ...nodes, [p.id]: { ...p, collapsed: false } }
            set({ nodes, currentMapId: n.mapId, selectedId: id, sheet: null, focusRequest: { id, n: Date.now() } })
          },

          importBackup: (data, mode) => {
            const { maps, nodes, viewports } = get()
            const res = mode === 'add' ? mergeBackup(maps, nodes, viewports, data) : replaceWithBackup(data)
            set({
              maps: res.maps,
              nodes: res.nodes,
              viewports: res.viewports,
              currentMapId: res.firstMapId ?? get().currentMapId,
              selectedId: null,
              sheet: null,
            })
            get().showToast(mode === 'add' ? 'Zaimportowano kopię' : 'Przywrócono kopię', true)
          },
          markExported: () => set({ lastExportAt: Date.now() }),
          undo: () => {
            useNous.temporal.getState().undo()
            const { selectedId, nodes, sheet } = get()
            if (selectedId && !nodes[selectedId]) set({ selectedId: null })
            if (sheet && 'id' in sheet && !nodes[sheet.id]) set({ sheet: null })
            fixCurrentMap()
          },
          redo: () => {
            useNous.temporal.getState().redo()
            fixCurrentMap()
          },
        }
      },
      {
        // historia obejmuje tylko dane, a nowy wpis powstaje tylko przy faktycznej zmianie
        partialize: (s) => ({ maps: s.maps, nodes: s.nodes, viewports: s.viewports }),
        equality: (a, b) => a.maps === b.maps && a.nodes === b.nodes,
        limit: 100,
      },
    ),
    {
      name: 'nous',
      version: 2,
      migrate: (persisted, version) => {
        const data = persisted as Data
        // v2: dzieci mają jawnie zapisany kolor gałęzi
        if (version < 2 && data?.nodes) data.nodes = T.materializeColors(data.nodes)
        return data as unknown as NousState
      },
      storage: createJSONStorage(() => idbStorage),
      partialize: (s): Data => ({
        maps: s.maps,
        nodes: s.nodes,
        viewports: s.viewports,
        currentMapId: s.currentMapId,
        view: s.view,
        lastExportAt: s.lastExportAt,
      }),
      onRehydrateStorage: () => () => {
        const s = useNous.getState()
        if (!Object.keys(s.maps).length) {
          const { map, nodes } = seedMap()
          useNous.setState({ maps: { [map.id]: map }, nodes, currentMapId: map.id })
        }
        fixCurrentMap()
        useNous.setState({ hydrated: true })
        useNous.temporal.getState().clear()
      },
    },
  ),
)

function fixCurrentMap() {
  const { maps, currentMapId } = useNous.getState()
  if (!currentMapId || !maps[currentMapId]) {
    const first = Object.values(maps).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    useNous.setState({ currentMapId: first?.id ?? null })
  }
}

export const useCurrentMap = () => useNous((s) => (s.currentMapId ? s.maps[s.currentMapId] : undefined))
