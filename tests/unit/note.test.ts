import { describe, expect, it } from 'vitest'
import { notePreview, parseNote, taskStats, toggleTask } from '../../src/model/note'
import { plural, toRoman } from '../../src/model/numerals'

describe('notatki', () => {
  const note = 'Oferta **+30%** i *zdalnie*\n\n- budżet\n[ ] zapytać szefa\n[x] CV'

  it('parsuje akapity, listy i zadania', () => {
    const b = parseNote(note)
    expect(b.map((x) => x.type)).toEqual(['p', 'gap', 'li', 'task', 'task'])
    expect(b[0].type === 'p' && b[0].inline[1]).toEqual({ text: '+30%', bold: true })
  })

  it('przełącza zadania i liczy postęp', () => {
    expect(taskStats(note)).toEqual({ done: 1, total: 2 })
    expect(taskStats(toggleTask(note, 3))).toEqual({ done: 2, total: 2 })
  })

  it('podgląd bez znaczników', () => {
    expect(notePreview(note)).toBe('Oferta +30% i zdalnie · budżet ☐ zapytać szefa ☑ CV')
  })
})

describe('liczebniki', () => {
  it('rzymskie i polska odmiana', () => {
    expect([1, 2, 3, 4, 9, 14].map(toRoman)).toEqual(['I', 'II', 'III', 'IV', 'IX', 'XIV'])
    const f: [string, string, string] = ['myśl', 'myśli', 'myśli']
    expect(plural(1, f)).toBe('myśl')
    expect(plural(3, ['punkt', 'punkty', 'punktów'])).toBe('punkty')
    expect(plural(12, ['punkt', 'punkty', 'punktów'])).toBe('punktów')
    expect(plural(22, ['punkt', 'punkty', 'punktów'])).toBe('punkty')
  })
})
