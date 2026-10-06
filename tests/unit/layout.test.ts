import { describe, expect, it } from 'vitest'
import { boundsOf, placeRootNear, tidy } from '../../src/model/layout'
import { addChild } from '../../src/model/tree'
import type { Nodes } from '../../src/model/types'
import { sample } from './helpers'

describe('layout', () => {
  it('pierwsze dziecko punktu centralnego trafia pod niego', () => {
    const s = sample()
    expect(s.nodes[s.A].y).toBeGreaterThan(s.nodes[s.R].y)
  })

  it('wiele dzieci nie nachodzi na siebie', () => {
    let { nodes, R } = sample()
    for (let i = 0; i < 8; i++) nodes = addChild(nodes, R, `k${i}`).nodes as Nodes
    const list = Object.values(nodes)
    for (const a of list) for (const b of list) {
      if (a.id === b.id) continue
      expect(Math.abs(a.x - b.x) >= 230 || Math.abs(a.y - b.y) >= 120).toBe(true)
    }
  })

  it('nowy punkt centralny ląduje z dala od istniejących', () => {
    const s = sample()
    const p = placeRootNear(s.nodes, 'm', 0, 0)
    for (const n of Object.values(s.nodes)) expect(Math.hypot(n.x - p.x, n.y - p.y)).toBeGreaterThanOrEqual(260)
  })

  it('tidy układa poziomy i zostawia punkt centralny w miejscu', () => {
    const s = sample()
    const nodes = tidy(s.nodes, s.R)
    expect(nodes[s.R]).toEqual(s.nodes[s.R])
    expect(nodes[s.A].y).toBe(nodes[s.B].y)
    expect(nodes[s.A1].y).toBeGreaterThan(nodes[s.A].y)
    expect(nodes[s.A1].x).toBeLessThan(nodes[s.A2].x)
    expect(nodes[s.R2]).toEqual(s.nodes[s.R2])
  })

  it('boundsOf', () => {
    expect(boundsOf([])).toBeNull()
    const s = sample()
    const b = boundsOf(Object.values(s.nodes))!
    expect(b.maxX).toBeGreaterThan(1500)
  })
})
