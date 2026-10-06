import { describe, expect, it } from 'vitest'
import {
  addChild, addSibling, childrenOf, deleteSubtree, depthOf, descendantIds, detachAsRoot, effectiveColor,
  hiddenIds, indent, isAncestorOrSelf, materializeColors, moveSubtree, nodeLabel, outdent, pathOf, recolorBranch, reparent, rootsOf, toggleCollapsed, updateNode,
} from '../../src/model/tree'
import { sample } from './helpers'

const titles = (list: { title: string }[]) => list.map((n) => n.title)

describe('struktura drzewa', () => {
  it('obsługuje kilka punktów centralnych w jednej mapie', () => {
    const { nodes } = sample()
    expect(titles(rootsOf(nodes, 'm'))).toEqual(['R', 'R2'])
  })

  it('zwraca dzieci w kolejności i potomków', () => {
    const { nodes, R, A } = sample()
    expect(titles(childrenOf(nodes, R, 'm'))).toEqual(['A', 'B'])
    expect(descendantIds(nodes, A).map((id) => nodes[id].title).sort()).toEqual(['A1', 'A2'])
    expect(descendantIds(nodes, R)).toHaveLength(4)
  })

  it('liczy ścieżkę, głębokość i etykiety', () => {
    const { nodes, A1, B, R2 } = sample()
    expect(titles(pathOf(nodes, A1))).toEqual(['R', 'A', 'A1'])
    expect(depthOf(nodes, A1)).toBe(2)
    expect(nodeLabel(nodes, R2)).toBe('Centrum 2')
    expect(nodeLabel(nodes, B)).toBe('Gałąź 2')
    expect(nodeLabel(nodes, A1)).toBeNull()
  })

  it('dziedziczy kolor po najbliższym przodku', () => {
    const s = sample()
    const nodes = updateNode(s.nodes, s.A, { color: 'sage' })
    expect(effectiveColor(nodes, s.A1)).toBe('sage')
    expect(effectiveColor(nodes, s.B)).toBeNull()
    expect(effectiveColor(updateNode(nodes, s.A1, { color: 'coral' }), s.A1)).toBe('coral')
  })
})

describe('dodawanie', () => {
  it('addChild rozwija zwiniętego rodzica i nie nakłada węzłów', () => {
    const s = sample()
    const collapsed = toggleCollapsed(s.nodes, s.A)
    const { nodes, id } = addChild(collapsed, s.A, 'A3')
    expect(nodes[s.A].collapsed).toBe(false)
    expect(nodes[id!].order).toBe(2)
    const others = Object.values(nodes).filter((n) => n.id !== id)
    expect(others.some((o) => o.x === nodes[id!].x && o.y === nodes[id!].y)).toBe(false)
  })

  it('addSibling wstawia zaraz za węzłem', () => {
    const s = sample()
    const { nodes } = addSibling(s.nodes, s.A1, 'nowy')
    expect(titles(childrenOf(nodes, s.A, 'm'))).toEqual(['A1', 'nowy', 'A2'])
  })

  it('addSibling dla punktu centralnego tworzy nowy punkt centralny', () => {
    const s = sample()
    const { nodes, id } = addSibling(s.nodes, s.R, 'R3')
    expect(nodes[id!].parentId).toBeNull()
    expect(rootsOf(nodes, 'm')).toHaveLength(3)
  })
})

describe('usuwanie i przesuwanie', () => {
  it('deleteSubtree usuwa poddrzewo i przenumerowuje rodzeństwo', () => {
    const s = sample()
    const nodes = deleteSubtree(s.nodes, s.A)
    expect(nodes[s.A1]).toBeUndefined()
    expect(nodes[s.B].order).toBe(0)
    expect(Object.keys(nodes)).toHaveLength(3)
  })

  it('moveSubtree przesuwa węzeł z całym poddrzewem', () => {
    const s = sample()
    const nodes = moveSubtree(s.nodes, s.A, 10, -20)
    expect(nodes[s.A1].x).toBe(s.nodes[s.A1].x + 10)
    expect(nodes[s.A2].y).toBe(s.nodes[s.A2].y - 20)
    expect(nodes[s.B].x).toBe(s.nodes[s.B].x)
  })
})

describe('zmiana rodzica', () => {
  it('blokuje cykle', () => {
    const s = sample()
    expect(reparent(s.nodes, s.A, s.A1, 0)).toBe(s.nodes)
    expect(reparent(s.nodes, s.A, s.A, 0)).toBe(s.nodes)
    expect(isAncestorOrSelf(s.nodes, s.R, s.A2)).toBe(true)
  })

  it('przenosi gałąź do innego punktu centralnego', () => {
    const s = sample()
    const nodes = reparent(s.nodes, s.A, s.R2, 0)
    expect(nodes[s.A].parentId).toBe(s.R2)
    expect(nodes[s.A1].parentId).toBe(s.A)
    expect(titles(childrenOf(nodes, s.R, 'm'))).toEqual(['B'])
    expect(nodes[s.B].order).toBe(0)
    // poddrzewo przesunięte w pobliże nowego rodzica
    expect(Math.abs(nodes[s.A].x - nodes[s.R2].x)).toBeLessThan(500)
  })

  it('zmienia kolejność w obrębie rodzica', () => {
    const s = sample()
    const nodes = reparent(s.nodes, s.A2, s.A, 0)
    expect(titles(childrenOf(nodes, s.A, 'm'))).toEqual(['A2', 'A1'])
  })

  it('indent / outdent', () => {
    const s = sample()
    let nodes = indent(s.nodes, s.B)
    expect(nodes[s.B].parentId).toBe(s.A)
    expect(titles(childrenOf(nodes, s.A, 'm'))).toEqual(['A1', 'A2', 'B'])
    expect(indent(nodes, s.A)).toBe(nodes) // pierwszy element nie ma poprzednika
    nodes = outdent(nodes, s.B)
    expect(titles(childrenOf(nodes, s.R, 'm'))).toEqual(['A', 'B'])
    nodes = outdent(nodes, s.A1)
    expect(titles(childrenOf(nodes, s.R, 'm'))).toEqual(['A', 'A1', 'B'])
  })

  it('outdent z pierwszego poziomu i detachAsRoot tworzą punkt centralny', () => {
    const s = sample()
    const nodes = detachAsRoot(s.nodes, s.A)
    expect(nodes[s.A].parentId).toBeNull()
    expect(titles(rootsOf(nodes, 'm'))).toEqual(['R', 'R2', 'A'])
    expect(nodes[s.A].x).toBe(s.nodes[s.A].x)
    expect(outdent(s.nodes, s.B)[s.B].parentId).toBeNull()
  })
})

describe('zwijanie', () => {
  it('ukrywa potomków zwiniętej gałęzi', () => {
    const s = sample()
    const nodes = toggleCollapsed(s.nodes, s.A)
    expect([...hiddenIds(nodes, 'm')].sort()).toEqual([s.A1, s.A2].sort())
  })
})

describe('kolor gałęzi', () => {
  it('nowe dziecko dostaje kolor gałęzi jako własny', () => {
    const s = sample()
    const nodes = updateNode(s.nodes, s.A, { color: 'sage' })
    const { nodes: out, id } = addChild(nodes, s.A, 'nowe')
    expect(out[id!].color).toBe('sage')
    expect(addChild(nodes, s.R, 'pod centrum').nodes).toBeDefined()
  })

  it('zmiana koloru gałęzi przechodzi na podpunkty w jej kolorze, ale nie na wyjątki', () => {
    const s = sample()
    let nodes = recolorBranch(s.nodes, s.A, 'sage')
    expect(nodes[s.A1].color).toBe('sage')
    nodes = updateNode(nodes, s.A2, { color: 'coral' })
    nodes = recolorBranch(nodes, s.A, 'iris')
    expect(nodes[s.A].color).toBe('iris')
    expect(nodes[s.A1].color).toBe('iris')
    expect(nodes[s.A2].color).toBe('coral')
    expect(nodes[s.B].color).toBeNull()
  })

  it('przeniesiona gałąź przejmuje kolor nowego rodzica', () => {
    const s = sample()
    let nodes = recolorBranch(s.nodes, s.A, 'sage')
    nodes = recolorBranch(nodes, s.B, 'sky')
    nodes = reparent(nodes, s.A1, s.B, 0)
    expect(nodes[s.A1].color).toBe('sky')
  })

  it('migracja zapisuje odziedziczone kolory jawnie', () => {
    const s = sample()
    const nodes = materializeColors(updateNode(s.nodes, s.A, { color: 'amber' }))
    expect(nodes[s.A1].color).toBe('amber')
    expect(nodes[s.R].color).toBeNull()
  })
})
