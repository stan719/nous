// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildListPdf, buildMapPdf, pdfFileName } from '../../src/lib/pdf'
import { seedMap } from '../../src/store/seed'

const fonts = ['Geist-Regular.ttf', 'Geist-Medium.ttf', 'InstrumentSerif-Regular.ttf'].map((f) => {
  const b = readFileSync(`public/fonts/${f}`)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
})

describe('eksport PDF', () => {
  const { map, nodes } = seedMap()

  it('mapa: jedna strona z tytułem i polskimi znakami', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const bytes = await buildMapPdf(map, nodes, theme, fonts)
      const doc = await PDFDocument.load(bytes)
      expect(doc.getPageCount()).toBe(1)
      expect(doc.getTitle()).toBe('Pierwsza mapa')
      if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/mapa-${theme}.pdf`, bytes)
    }
  })

  it('lista: A4, długa treść dzieli się na strony', async () => {
    const big = { ...nodes }
    const parent = Object.values(nodes).find((n) => n.title === 'Notatki')!
    for (let i = 0; i < 60; i++) {
      const id = `x${i}`
      big[id] = { ...parent, id, parentId: parent.id, order: 10 + i, title: `Punkt ${i} — zażółć gęślą jaźń`, note: '- lista\n[ ] zadanie\n[x] zrobione **ważne**' }
    }
    const bytes = await buildListPdf(map, big, 'light', fonts)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(2)
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
    expect(Math.round(w)).toBe(595)
    expect(Math.round(h)).toBe(842)
    if (process.env.PDF_OUT) {
      writeFileSync(`${process.env.PDF_OUT}/lista-light.pdf`, await buildListPdf(map, nodes, 'light', fonts))
      writeFileSync(`${process.env.PDF_OUT}/lista-dark.pdf`, await buildListPdf(map, nodes, 'dark', fonts))
    }
  })

  it('nazwa pliku bez polskich znaków', () => {
    expect(pdfFileName({ ...map, title: 'Łódź: plan 2027!' }, 'list')).toBe('lodz-plan-2027-lista.pdf')
  })
})
