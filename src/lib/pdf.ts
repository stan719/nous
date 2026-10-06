import fontkit from '@pdf-lib/fontkit'
import { LineCapStyle, PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { parseNote, notePreview, type Inline } from '../model/note'
import { plural, toRoman } from '../model/numerals'
import { childIndex, effectiveColor } from '../model/tree'
import type { Color, MapNode, MindMap, Nodes } from '../model/types'
import { visibleGraph, type VisibleNode } from '../views/canvas/graph'
import { edgePath } from '../views/canvas/Edges'

export type PdfKind = 'map' | 'list'
export type PdfTheme = 'light' | 'dark'

// ---------- motywy ----------
interface Theme {
  bg: string
  surface: string
  ink: string
  muted: string
  faint: string
  gold: string
  line: string
  rootFill: string
  rootText: string
  rootEyebrow: string
  colors: Record<Color | 'none', string>
}

const THEMES: Record<PdfTheme, Theme> = {
  dark: {
    bg: '#0a0a0b',
    surface: '#131315',
    ink: '#f3f0ea',
    muted: '#a8a49c',
    faint: '#77736c',
    gold: '#d8b77a',
    line: '#2a2a2e',
    rootFill: '#f3f0ea',
    rootText: '#0b0b0c',
    rootEyebrow: '#8a6a2e',
    colors: { pearl: '#d9d5ce', sky: '#7fb5e8', sage: '#8cc39b', amber: '#e9bb69', coral: '#ef8f72', rose: '#ec9ab4', iris: '#ab9cf5', none: '#8d8981' },
  },
  // jasny do druku: ten sam układ, kolory przyciemnione dla kontrastu na papierze
  light: {
    bg: '#fbfaf7',
    surface: '#ffffff',
    ink: '#1b1a18',
    muted: '#5f5b54',
    faint: '#9a958c',
    gold: '#9a7433',
    line: '#e4dfd5',
    rootFill: '#1b1a18',
    rootText: '#fbfaf7',
    rootEyebrow: '#d8b77a',
    colors: { pearl: '#8a857c', sky: '#3b7cc0', sage: '#4a8d5c', amber: '#b07d1f', coral: '#c65f3e', rose: '#c2557b', iris: '#6d5bd0', none: '#9a958c' },
  },
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const col = (h: string): RGB => {
  const [r, g, b] = hex(h)
  return rgb(r / 255, g / 255, b / 255)
}
/** mieszanie kolorów jak color-mix(): t = udział `a` */
const mix = (a: string, b: string, t: number) => {
  const x = hex(a)
  const y = hex(b)
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
}

// ---------- czcionki ----------
interface Fonts {
  sans: PDFFont
  medium: PDFFont
  serif: PDFFont
}

let fontBytes: Promise<ArrayBuffer[]> | null = null
/** Czcionki TTF leżą w public/fonts i są w cache service workera — PDF działa offline. */
export function preloadPdfFonts() {
  const base = import.meta.env.BASE_URL
  fontBytes ??= Promise.all(
    ['Geist-Regular.ttf', 'Geist-Medium.ttf', 'InstrumentSerif-Regular.ttf'].map((f) =>
      fetch(`${base}fonts/${f}`).then((r) => {
        if (!r.ok) throw new Error(`Brak czcionki ${f}`)
        return r.arrayBuffer()
      }),
    ),
  ).catch((e) => {
    fontBytes = null
    throw e
  })
  return fontBytes
}

async function embedFonts(doc: PDFDocument, bytes?: ArrayBuffer[]): Promise<Fonts> {
  doc.registerFontkit(fontkit)
  const [r, m, s] = bytes ?? (await preloadPdfFonts())
  return {
    sans: await doc.embedFont(r, { subset: true }),
    medium: await doc.embedFont(m, { subset: true }),
    serif: await doc.embedFont(s, { subset: true }),
  }
}

// ---------- tekst ----------
type Seg = { text: string; font: PDFFont }

/** Łamie tekst (z pogrubieniami) na linie o maksymalnej szerokości. */
function wrapRich(inline: Inline[], f: Fonts, regular: PDFFont, size: number, maxW: number): Seg[][] {
  const words: Seg[] = []
  for (const i of inline) {
    const font = i.bold ? f.medium : regular
    for (const part of i.text.split(/(\s+)/)) if (part) words.push({ text: part, font })
  }
  const lines: Seg[][] = []
  let line: Seg[] = []
  let w = 0
  const push = () => {
    while (line.length && !line[line.length - 1].text.trim()) line.pop()
    lines.push(line)
    line = []
    w = 0
  }
  for (const word of words) {
    const ww = word.font.widthOfTextAtSize(word.text, size)
    if (!word.text.trim()) {
      if (line.length) {
        line.push({ text: ' ', font: word.font })
        w += word.font.widthOfTextAtSize(' ', size)
      }
      continue
    }
    if (w + ww > maxW && line.length) push()
    if (ww > maxW) {
      // bardzo długie słowo (np. link) — łamiemy po znakach
      let chunk = ''
      for (const ch of word.text) {
        if (word.font.widthOfTextAtSize(chunk + ch, size) > maxW && chunk) {
          line.push({ text: chunk, font: word.font })
          push()
          chunk = ''
        }
        chunk += ch
      }
      line.push({ text: chunk, font: word.font })
      w = word.font.widthOfTextAtSize(chunk, size)
    } else {
      line.push(word)
      w += ww
    }
  }
  if (line.length) push()
  return lines.length ? lines : [[]]
}

const wrapPlain = (text: string, font: PDFFont, f: Fonts, size: number, maxW: number) =>
  wrapRich([{ text }], { ...f, medium: font }, font, size, maxW).map((l) => l.map((s) => s.text).join(''))

/** Przycina linie do `max`, dodając wielokropek w ostatniej. */
function clampLines(lines: string[], max: number, font: PDFFont, size: number, maxW: number) {
  if (lines.length <= max) return lines
  const out = lines.slice(0, max)
  let last = out[max - 1]
  while (last && font.widthOfTextAtSize(last + '…', size) > maxW) last = last.slice(0, -1)
  out[max - 1] = last.trimEnd() + '…'
  return out
}

/** Rysowanie w układzie „od lewego górnego rogu” (jak w CSS), ze wspólną skalą. */
class Ink {
  constructor(
    public page: PDFPage,
    private h: number,
    private s = 1,
  ) {}
  rect(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, strokeW = 1) {
    const s = this.s
    r = Math.min(r, h / 2, w / 2)
    const d = `M${(x + r) * s},${y * s} H${(x + w - r) * s} A${r * s},${r * s} 0 0 1 ${(x + w) * s},${(y + r) * s} V${(y + h - r) * s} A${r * s},${r * s} 0 0 1 ${(x + w - r) * s},${(y + h) * s} H${(x + r) * s} A${r * s},${r * s} 0 0 1 ${x * s},${(y + h - r) * s} V${(y + r) * s} A${r * s},${r * s} 0 0 1 ${(x + r) * s},${y * s} Z`
    this.page.drawSvgPath(d, {
      x: 0,
      y: this.h,
      color: fill ? col(fill) : undefined,
      borderColor: stroke ? col(stroke) : undefined,
      borderWidth: stroke ? strokeW * s : 0,
    })
  }
  path(d: string, stroke: string, width: number, opacity = 1) {
    this.page.drawSvgPath(d, {
      x: 0,
      y: this.h,
      scale: this.s,
      borderColor: col(stroke),
      borderWidth: width * this.s,
      borderOpacity: opacity,
      borderLineCap: LineCapStyle.Round,
    })
  }
  circle(cx: number, cy: number, r: number, fill: string) {
    this.page.drawCircle({ x: cx * this.s, y: this.h - cy * this.s, size: r * this.s, color: col(fill) })
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, w = 1) {
    this.page.drawLine({ start: { x: x1 * this.s, y: this.h - y1 * this.s }, end: { x: x2 * this.s, y: this.h - y2 * this.s }, thickness: w * this.s, color: col(color) })
  }
  /** `top` to górna krawędź linii tekstu o wysokości `lh` */
  text(t: string, x: number, top: number, font: PDFFont, size: number, color: string, lh = size * 1.3, spacing = 0) {
    if (!t) return
    const asc = font.heightAtSize(size, { descender: false })
    const desc = font.heightAtSize(size) - asc
    const base = top + (lh - (asc + desc)) / 2 + asc
    if (spacing) {
      // rozstrzelenie liter (etykiety „CENTRUM 1”)
      let cx = x
      for (const ch of t) {
        this.page.drawText(ch, { x: cx * this.s, y: this.h - base * this.s, size: size * this.s, font, color: col(color) })
        cx += font.widthOfTextAtSize(ch, size) + spacing
      }
      return
    }
    this.page.drawText(t, { x: x * this.s, y: this.h - base * this.s, size: size * this.s, font, color: col(color) })
  }
  segs(line: Seg[], x: number, top: number, size: number, color: string, lh: number) {
    let cx = x
    for (const seg of line) {
      this.text(seg.text, cx, top, seg.font, size, color, lh)
      cx += seg.font.widthOfTextAtSize(seg.text, size)
    }
  }
}

const spacedWidth = (t: string, font: PDFFont, size: number, sp: number) => font.widthOfTextAtSize(t, size) + sp * Math.max(0, [...t].length - 1)

const dateLabel = () => new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

function stats(nodes: Nodes, mapId: string) {
  const list = Object.values(nodes).filter((n) => n.mapId === mapId)
  const roots = list.filter((n) => n.parentId === null).length
  return `${list.length} ${plural(list.length, ['myśl', 'myśli', 'myśli'])} · ${roots} ${plural(roots, ['centrum', 'centra', 'centrów'])} · ${dateLabel()}`
}

// ---------- mapa (kanwa) ----------
interface Box {
  v: VisibleNode
  w: number
  h: number
  kind: 'root' | 'card' | 'chip'
  lines: string[]
  note: string[]
}

function measureMap(list: VisibleNode[], f: Fonts, showNotes: boolean): Box[] {
  return list.map((v) => {
    const n = v.node
    const hasNote = !!n.note.trim()
    if (v.depth === 0) {
      const lines = wrapPlain(n.title.trim() || 'Punkt centralny', f.serif, f, 24, 236)
      const w = Math.max(130, ...lines.map((l) => f.serif.widthOfTextAtSize(l, 24))) + 44
      return { v, w, h: 11 + 14 + lines.length * 26 + 13, kind: 'root', lines, note: [] }
    }
    if (showNotes && (hasNote || v.depth === 1)) {
      const lines = clampLines(wrapPlain(n.title.trim() || 'Nowa myśl', f.medium, f, 15.5, 192), 4, f.medium, 15.5, 192)
      const note = hasNote ? clampLines(wrapPlain(notePreview(n.note), f.sans, f, 13, 192), 3, f.sans, 13, 192) : []
      return { v, w: 220, h: 10 + 18 + 6 + lines.length * 20 + (note.length ? 6 + note.length * 18.5 : 0) + 13, kind: 'card', lines, note }
    }
    const extra = (hasNote ? 15 : 0) + (n.priority ? 30 : 0)
    const maxText = 230 - 24 - 15 - extra
    const lines = clampLines(wrapPlain(n.title.trim() || 'Nowa myśl', f.medium, f, 14, maxText), 2, f.medium, 14, maxText)
    const textW = Math.max(...lines.map((l) => f.medium.widthOfTextAtSize(l, 14)))
    return { v, w: 11 + 7 + 8 + textW + extra + 13, h: 16 + lines.length * 17.5, kind: 'chip', lines, note: [] }
  })
}

function prioBadge(ink: Ink, p: number, right: number, top: number, f: Fonts, t: Theme) {
  if (!p) return 0
  const label = toRoman(p)
  const w = f.serif.widthOfTextAtSize(label, 12) + 13
  const color = p === 3 ? t.gold : p === 2 ? t.ink : t.muted
  ink.rect(right - w, top, w, 17, 9, undefined, p === 3 ? mix(t.gold, t.bg, 0.55) : mix(t.ink, t.bg, 0.2), 1)
  ink.text(label, right - w + 6.5, top, f.serif, 12, color, 17)
  return w
}

export async function buildMapPdf(map: MindMap, nodes: Nodes, theme: PdfTheme, fontData?: ArrayBuffer[]): Promise<Uint8Array> {
  const t = THEMES[theme]
  const doc = await PDFDocument.create()
  const f = await embedFonts(doc, fontData)
  const list = visibleGraph(nodes, map.id)
  const boxes = measureMap(list, f, map.showNotes)

  const pad = 56
  const header = 92
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.v.node.x - b.w / 2)
    maxX = Math.max(maxX, b.v.node.x + b.w / 2)
    minY = Math.min(minY, b.v.node.y - b.h / 2)
    maxY = Math.max(maxY, b.v.node.y + b.h / 2)
  }
  if (!boxes.length) minX = minY = maxX = maxY = 0
  const titleW = f.serif.widthOfTextAtSize(map.title, 30)
  const W = Math.max(maxX - minX + pad * 2, titleW + pad * 2, 480)
  const H = maxY - minY + pad * 2 + header
  // PDF ma limit 14 400 pt na bok — bardzo duże mapy zmniejszamy proporcjonalnie
  const s = Math.min(1, 14000 / W, 14000 / H)
  const page = doc.addPage([W * s, H * s])
  const ink = new Ink(page, H * s, s)
  ink.rect(0, 0, W, H, 0, t.bg)

  ink.text(map.title, pad, pad - 18, f.serif, 30, t.ink, 36)
  ink.text(stats(nodes, map.id), pad, pad + 20, f.sans, 11, t.muted, 16)
  ink.line(pad, pad + 46, W - pad, pad + 46, t.line, 1)

  const ox = pad - minX + (W - pad * 2 - (maxX - minX)) / 2
  const oy = pad + header - minY
  const pos = (n: MapNode) => ({ x: n.x + ox, y: n.y + oy })
  const byId = new Map(list.map((v) => [v.node.id, v.node]))

  for (const v of list) {
    const p = v.node.parentId ? byId.get(v.node.parentId) : null
    if (!p) continue
    const c = t.colors[v.color ?? 'none']
    ink.path(edgePath(pos(p), pos(v.node)), c, v.depth === 1 ? 2.4 : 1.6, v.depth === 1 ? 0.62 : 0.45)
  }

  for (const b of boxes) {
    const n = b.v.node
    const c = t.colors[b.v.color ?? 'none']
    const { x: cx, y: cy } = pos(n)
    const x = cx - b.w / 2
    const y = cy - b.h / 2
    if (b.kind === 'root') {
      ink.rect(x - 6, y - 6, b.w + 12, b.h + 12, 34, mix(t.rootFill, t.bg, 0.08))
      ink.rect(x, y, b.w, b.h, 28, t.rootFill)
      const eb = b.v.label!.toUpperCase()
      ink.text(eb, cx - spacedWidth(eb, f.medium, 9, 1.6) / 2, y + 11, f.medium, 9, t.rootEyebrow, 12, 1.6)
      b.lines.forEach((l, i) => ink.text(l, cx - f.serif.widthOfTextAtSize(l, 24) / 2, y + 25 + i * 26, f.serif, 24, t.rootText, 26))
    } else if (b.kind === 'card') {
      ink.rect(x, y, b.w, b.h, 20, mix(c, t.surface, 0.1), mix(c, t.bg, 0.38), 1)
      ink.circle(x + 17.5, y + 19, 3.5, c)
      let lx = x + 27
      if (b.v.label) {
        const lab = b.v.label.toUpperCase()
        ink.text(lab, lx, y + 12, f.sans, 9.5, t.muted, 14, 1.3)
        lx += spacedWidth(lab, f.sans, 9.5, 1.3) + 6
      } else if (n.note.trim()) ink.text('¶', lx, y + 12, f.serif, 13, t.gold, 14)
      prioBadge(ink, n.priority, x + b.w - 14, y + 10.5, f, t)
      let ty = y + 34
      for (const l of b.lines) {
        ink.text(l, x + 14, ty, f.medium, 15.5, t.ink, 20)
        ty += 20
      }
      if (b.note.length) {
        ty += 6
        b.note.forEach((l, i) => {
          const lead = i === 0 && b.v.label ? f.serif.widthOfTextAtSize('¶', 14) + 4 : 0
          if (lead) ink.text('¶', x + 14, ty, f.serif, 14, t.gold, 18.5)
          ink.text(l, x + 14 + lead, ty, f.sans, 13, t.muted, 18.5)
          ty += 18.5
        })
      }
    } else {
      ink.rect(x, y, b.w, b.h, 15, b.v.depth === 1 ? mix(c, t.surface, 0.12) : t.surface, mix(c, t.bg, 0.34), 1)
      ink.circle(x + 14.5, cy, 3.5, c)
      const top = cy - (b.lines.length * 17.5) / 2
      b.lines.forEach((l, i) => ink.text(l, x + 26, top + i * 17.5, f.medium, 14, t.ink, 17.5))
      let rx = x + b.w - 13
      if (n.priority) rx -= prioBadge(ink, n.priority, rx, cy - 8.5, f, t) + 8
      if (n.note.trim()) ink.text('¶', rx - 7, cy - 9, f.serif, 15, t.faint, 18)
    }
  }

  ink.text('Nous', W - pad - f.serif.widthOfTextAtSize('Nous', 14), H - 34, f.serif, 14, t.faint, 18)
  setMeta(doc, map)
  return doc.save()
}

// ---------- lista (konspekt A4) ----------
export async function buildListPdf(map: MindMap, nodes: Nodes, theme: PdfTheme, fontData?: ArrayBuffer[]): Promise<Uint8Array> {
  const t = THEMES[theme]
  const doc = await PDFDocument.create()
  const f = await embedFonts(doc, fontData)
  const PW = 595.28
  const PH = 841.89
  const M = 56
  const BOTTOM = PH - M - 18
  const pages: Ink[] = []
  let ink!: Ink
  let y = 0

  const newPage = () => {
    const page = doc.addPage([PW, PH])
    ink = new Ink(page, PH)
    ink.rect(0, 0, PW, PH, 0, t.bg)
    pages.push(ink)
    y = M
  }
  const need = (h: number) => {
    if (y + h > BOTTOM) newPage()
  }

  newPage()
  for (const l of wrapPlain(map.title, f.serif, f, 32, PW - M * 2)) {
    ink.text(l, M, y, f.serif, 32, t.ink, 36)
    y += 36
  }
  ink.text(stats(nodes, map.id), M, y + 4, f.sans, 10, t.muted, 14)
  y += 28
  ink.line(M, y, PW - M, y, t.gold, 0.8)
  y += 22

  /** Notatka: akapity, listy, zadania; `x` to lewa krawędź, `w` dostępna szerokość. */
  const drawNote = (note: string, x: number, w: number, size: number) => {
    const lh = size * 1.45
    for (const b of parseNote(note)) {
      if (b.type === 'gap') {
        y += lh * 0.45
        continue
      }
      const indent = b.type === 'p' ? 0 : 14
      const lines = wrapRich(b.inline, f, f.sans, size, w - indent)
      lines.forEach((line, i) => {
        need(lh)
        if (i === 0 && b.type === 'li') ink.circle(x + 4, y + lh / 2, 1.8, t.gold)
        if (i === 0 && b.type === 'task') {
          ink.rect(x, y + lh / 2 - 4.5, 9, 9, 2.5, b.done ? t.gold : undefined, b.done ? undefined : t.faint, 0.8)
          if (b.done) ink.path(`M${x + 2},${y + lh / 2} L${x + 4},${y + lh / 2 + 2.2} L${x + 7.2},${y + lh / 2 - 2.4}`, t.bg, 1.3)
        }
        const color = b.type === 'task' && b.done ? t.faint : t.muted
        ink.segs(line, x + indent, y, size, color, lh)
        if (b.type === 'task' && b.done) {
          const lw = line.reduce((s, seg) => s + seg.font.widthOfTextAtSize(seg.text, size), 0)
          ink.line(x + indent, y + lh / 2, x + indent + lw, y + lh / 2, t.faint, 0.6)
        }
        y += lh
      })
    }
  }

  const idx = childIndex(nodes, map.id)
  const roots = idx.get(null) ?? []
  roots.forEach((root, ri) => {
    if (ri > 0) y += 18
    need(80)
    const eb = `CENTRUM ${ri + 1}`
    ink.text(eb, M, y, f.medium, 8.5, t.gold, 12, 1.6)
    y += 15
    for (const l of wrapPlain(root.title.trim() || 'Punkt centralny', f.serif, f, 23, PW - M * 2 - 40)) {
      need(28)
      ink.text(l, M, y, f.serif, 23, t.ink, 28)
      y += 28
    }
    if (root.priority) prioBadge(ink, root.priority, PW - M, y - 24, f, t)
    if (root.note.trim()) {
      y += 2
      drawNote(root.note, M, PW - M * 2, 10)
    }
    y += 8

    const walk = (parentId: string, depth: number) => {
      for (const n of idx.get(parentId) ?? []) {
        const x = M + (depth - 1) * 20
        const c = t.colors[effectiveColor(nodes, n.id) ?? 'none']
        const size = depth === 1 ? 12.5 : 11.5
        const font = depth === 1 ? f.medium : f.sans
        const lh = size * 1.4
        const titleW = PW - M - x - 14 - (n.priority ? 34 : 0)
        const lines = wrapPlain(n.title.trim() || 'Nowa myśl', font, f, size, titleW)
        need(lh + 4)
        y += depth === 1 ? 7 : 3
        ink.circle(x + 3, y + lh / 2, 3, c)
        if (n.priority) prioBadge(ink, n.priority, PW - M, y + (lh - 17) / 2, f, t)
        lines.forEach((l) => {
          need(lh)
          ink.text(l, x + 13, y, font, size, t.ink, lh)
          y += lh
        })
        if (n.note.trim()) {
          y += 1
          drawNote(n.note, x + 13, PW - M - x - 13, 9.5)
        }
        walk(n.id, depth + 1)
      }
    }
    walk(root.id, 1)
  })

  // stopki z numeracją dopiero teraz, gdy znamy liczbę stron
  pages.forEach((p, i) => {
    p.text('Nous', M, PH - M + 6, f.serif, 12, t.faint, 16)
    const num = `${i + 1} / ${pages.length}`
    p.text(num, PW - M - f.sans.widthOfTextAtSize(num, 9), PH - M + 6, f.sans, 9, t.faint, 16)
    p.text(map.title, M + 40, PH - M + 6, f.sans, 9, t.faint, 16)
  })
  setMeta(doc, map)
  return doc.save()
}

function setMeta(doc: PDFDocument, map: MindMap) {
  doc.setTitle(map.title)
  doc.setCreator('Nous — mapa myśli')
  doc.setProducer('Nous')
  doc.setLanguage('pl-PL')
}

export const pdfFileName = (map: MindMap, kind: PdfKind) => {
  const slug = map.title
    .toLocaleLowerCase('pl')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'mapa'}-${kind === 'map' ? 'mapa' : 'lista'}.pdf`
}
