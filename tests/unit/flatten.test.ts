import { describe, expect, it } from 'vitest'
import { flatten, getProjection, INDENT } from '../../src/views/list/flatten'
import { toggleCollapsed } from '../../src/model/tree'
import { sample } from './helpers'

describe('lista: spłaszczanie i projekcja przeciągania', () => {
  it('kolejność czytania, głębokości i zwinięte gałęzie', () => {
    const s = sample()
    expect(flatten(s.nodes, 'm').map((i) => [i.node.title, i.depth])).toEqual([
      ['R', 0], ['A', 1], ['A1', 2], ['A2', 2], ['B', 1], ['R2', 0],
    ])
    expect(flatten(toggleCollapsed(s.nodes, s.A), 'm').map((i) => i.node.title)).toEqual(['R', 'A', 'B', 'R2'])
  })

  it('przesunięcie w prawo robi wcięcie pod poprzedni element', () => {
    const s = sample()
    const items = flatten(s.nodes, 'm', s.B)
    expect(getProjection(items, s.B, s.B, INDENT)).toEqual({ depth: 2, parentId: s.A, index: 2 })
  })

  it('przesunięcie w lewo z pierwszego poziomu tworzy punkt centralny', () => {
    const s = sample()
    const items = flatten(s.nodes, 'm', s.B)
    expect(getProjection(items, s.B, s.B, -INDENT)).toEqual({ depth: 0, parentId: null, index: 1 })
  })

  it('przeniesienie na koniec listy pod drugi punkt centralny', () => {
    const s = sample()
    const items = flatten(s.nodes, 'm', s.A1)
    expect(getProjection(items, s.A1, s.R2, INDENT * -1)).toEqual({ depth: 1, parentId: s.R2, index: 0 })
  })
})
