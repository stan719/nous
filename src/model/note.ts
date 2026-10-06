/**
 * Minimalny „markdown” dla notatek: **pogrubienie**, *kursywa*,
 * listy „- ” oraz zadania „[ ] ” / „[x] ”. Wynik to drzewo danych
 * renderowane przez React (bez innerHTML), więc treść jest bezpieczna.
 */
export type Inline = { text: string; bold?: boolean; italic?: boolean }
export type Block =
  | { type: 'p'; inline: Inline[] }
  | { type: 'li'; inline: Inline[] }
  | { type: 'task'; done: boolean; inline: Inline[]; line: number }
  | { type: 'gap' }

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ text: m[1], bold: true })
    else out.push({ text: m[2], italic: true })
    last = re.lastIndex
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export function parseNote(note: string): Block[] {
  const blocks: Block[] = []
  note.split('\n').forEach((raw, line) => {
    const s = raw.trimEnd()
    let m: RegExpMatchArray | null
    if (!s.trim()) {
      if (blocks.length && blocks[blocks.length - 1].type !== 'gap') blocks.push({ type: 'gap' })
    } else if ((m = s.match(/^\s*(?:[-*]\s+)?\[( |x|X)\]\s+(.*)$/))) {
      blocks.push({ type: 'task', done: m[1] !== ' ', inline: parseInline(m[2]), line })
    } else if ((m = s.match(/^\s*[-*•–—]\s+(.*)$/))) {
      blocks.push({ type: 'li', inline: parseInline(m[1]) })
    } else {
      blocks.push({ type: 'p', inline: parseInline(s) })
    }
  })
  while (blocks.length && blocks[blocks.length - 1].type === 'gap') blocks.pop()
  return blocks
}

/** Przełącza zadanie w danej linii notatki. */
export function toggleTask(note: string, line: number): string {
  const lines = note.split('\n')
  const l = lines[line]
  if (l === undefined) return note
  lines[line] = l.replace(/\[( |x|X)\]/, (_, c: string) => (c === ' ' ? '[x]' : '[ ]'))
  return lines.join('\n')
}

/** Zwykły tekst do podglądu na karcie (bez znaczników). */
export function notePreview(note: string): string {
  const flat = (inline: Inline[]) => inline.map((i) => i.text).join('')
  return parseNote(note)
    .map((b) => {
      if (b.type === 'gap') return ''
      if (b.type === 'task') return (b.done ? '☑ ' : '☐ ') + flat(b.inline)
      if (b.type === 'li') return '· ' + flat(b.inline)
      return flat(b.inline)
    })
    .filter(Boolean)
    .join(' ')
}

export function taskStats(note: string): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const b of parseNote(note)) if (b.type === 'task') {
    total++
    if (b.done) done++
  }
  return { done, total }
}
