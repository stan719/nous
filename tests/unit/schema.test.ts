import { describe, expect, it } from 'vitest'
import { makeBackup, mergeBackup, parseBackup, replaceWithBackup } from '../../src/model/schema'
import type { Maps } from '../../src/model/types'
import { sample } from './helpers'

const maps: Maps = { m: { id: 'm', title: 'Plan', showNotes: true, createdAt: 1, updatedAt: 1 } }

describe('kopia zapasowa', () => {
  it('eksport → import (round-trip)', () => {
    const s = sample()
    const backup = makeBackup(maps, s.nodes, { m: { x: 1, y: 2, k: 1 } })
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const restored = replaceWithBackup(parsed.data)
    expect(restored.nodes).toEqual(s.nodes)
    expect(restored.maps).toEqual(maps)
    expect(restored.viewports.m.k).toBe(1)
  })

  it('odrzuca zły JSON i obcy format', () => {
    expect(parseBackup('{nie json').ok).toBe(false)
    expect(parseBackup('{"app":"inna"}').ok).toBe(false)
  })

  it('naprawia sieroty i cykle', () => {
    const s = sample()
    const backup = makeBackup(maps, s.nodes, {})
    backup.nodes = backup.nodes.filter((n) => n.id !== s.A) // A1, A2 zostają sierotami
    backup.nodes = backup.nodes.map((n) => (n.id === s.R ? { ...n, parentId: s.B } : n)) // cykl R ↔ B
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const byId = Object.fromEntries(parsed.data.nodes.map((n) => [n.id, n]))
    expect(byId[s.A1].parentId).toBeNull()
    expect(byId[s.R].parentId === null || byId[s.B].parentId === null).toBe(true)
  })

  it('merge nadaje nowe identyfikatory i zachowuje strukturę', () => {
    const s = sample()
    const backup = makeBackup(maps, s.nodes, {})
    const merged = mergeBackup(maps, s.nodes, {}, backup)
    expect(Object.keys(merged.maps)).toHaveLength(2)
    expect(Object.keys(merged.nodes)).toHaveLength(12)
    const newMap = merged.firstMapId!
    expect(merged.maps[newMap].title).toBe('Plan (import)')
    const imported = Object.values(merged.nodes).filter((n) => n.mapId === newMap)
    const a1 = imported.find((n) => n.title === 'A1')!
    expect(merged.nodes[a1.parentId!].title).toBe('A')
  })
})
