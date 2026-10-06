export const COLORS = ['pearl', 'sky', 'sage', 'amber', 'coral', 'rose', 'iris'] as const
export type Color = (typeof COLORS)[number]

export const COLOR_NAMES: Record<Color, string> = {
  pearl: 'Perła',
  sky: 'Niebo',
  sage: 'Szałwia',
  amber: 'Bursztyn',
  coral: 'Koral',
  rose: 'Róż',
  iris: 'Irys',
}

export type Priority = 0 | 1 | 2 | 3
export const PRIORITY_NAMES = ['Brak', 'Niski', 'Średni', 'Wysoki'] as const

export interface MapNode {
  id: string
  mapId: string
  /** null = punkt centralny */
  parentId: string | null
  order: number
  title: string
  note: string
  /** null = dziedziczy kolor po rodzicu */
  color: Color | null
  priority: Priority
  x: number
  y: number
  collapsed: boolean
  createdAt: number
  updatedAt: number
}

export interface MindMap {
  id: string
  title: string
  showNotes: boolean
  createdAt: number
  updatedAt: number
}

export interface Viewport {
  x: number
  y: number
  k: number
}

export type Nodes = Record<string, MapNode>
export type Maps = Record<string, MindMap>

export interface BackupFile {
  app: 'nous'
  version: 1
  exportedAt: number
  maps: MindMap[]
  nodes: MapNode[]
  viewports?: Record<string, Viewport>
}
