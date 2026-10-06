import { IconBold, IconCheckbox, IconCornerDownRight, IconItalic, IconList, IconPlus, IconTarget, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PriorityPicker } from '../components/PriorityPicker'
import { Swatches } from '../components/Swatches'
import { primeKeyboard } from '../lib/ios'
import { effectiveColor } from '../model/tree'
import type { Color, Priority } from '../model/types'
import { useNous } from '../store/useNous'
import { Sheet } from './Sheet'

/** Pole tekstowe rosnące razem z treścią. */
function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string, min: number) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(min, el.scrollHeight + 2)}px`
  }, [ref, value, min])
}

export function EditSheet({ id, isNew }: { id: string; isNew?: boolean }) {
  const node = useNous((s) => s.nodes[id])
  const inherited = useNous((s) => (s.nodes[id]?.parentId ? effectiveColor(s.nodes, s.nodes[id].parentId!) : null))
  const hasKids = useNous((s) => Object.values(s.nodes).some((n) => n.parentId === id))
  const s = useNous.getState()

  const [title, setTitle] = useState(node?.title ?? '')
  const [note, setNote] = useState(node?.note ?? '')
  const [color, setColor] = useState<Color | null>(node?.color ?? null)
  const [priority, setPriority] = useState<Priority>(node?.priority ?? 0)
  const [asRoot, setAsRoot] = useState(node?.parentId === null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  useAutosize(titleRef, title, 54)
  useAutosize(noteRef, note, 120)

  useEffect(() => {
    // focus przejmuje klawiaturę „rozgrzaną” przez primeKeyboard()
    const t = setTimeout(() => {
      const el = isNew || !node?.title ? titleRef.current : null
      el?.focus({ preventScroll: true })
      if (el) el.setSelectionRange(el.value.length, el.value.length)
    }, 30)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Zapisuje szkic. Zwraca false, gdy nowy węzeł był pusty i został odrzucony. */
  const save = useCallback((): boolean => {
    const st = useNous.getState()
    const n = st.nodes[id]
    if (!n) return false
    if (isNew && !title.trim() && !note.trim()) {
      st.discardNew(id)
      return false
    }
    const patch = { title: title.trim(), note: note.replace(/\s+$/, ''), color, priority }
    if (patch.title !== n.title || patch.note !== n.note || patch.color !== n.color || patch.priority !== n.priority) st.updateNode(id, patch)
    if (asRoot && n.parentId !== null) st.detachAsRoot(id)
    return true
  }, [id, isNew, title, note, color, priority, asRoot])

  const done = () => {
    save()
    useNous.getState().closeSheet()
  }
  const cancel = () => {
    if (isNew) useNous.getState().discardNew(id)
    useNous.getState().closeSheet()
  }

  if (!node) return null
  const isRoot = node.parentId === null

  /** Wstawia znacznik markdown wokół zaznaczenia albo na początku linii. */
  const format = (kind: 'bold' | 'italic' | 'list' | 'task') => {
    const el = noteRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    let next: string
    let caret: number
    if (kind === 'bold' || kind === 'italic') {
      const m = kind === 'bold' ? '**' : '*'
      next = value.slice(0, a) + m + value.slice(a, b) + m + value.slice(b)
      caret = b + m.length * (a === b ? 1 : 2)
    } else {
      const prefix = kind === 'list' ? '- ' : '[ ] '
      const lineStart = value.lastIndexOf('\n', a - 1) + 1
      const atEmptyLine = value.slice(lineStart, a).trim() === ''
      if (atEmptyLine) {
        next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
        caret = lineStart + prefix.length
      } else {
        const lineEnd = value.indexOf('\n', b) === -1 ? value.length : value.indexOf('\n', b)
        next = value.slice(0, lineEnd) + '\n' + prefix + value.slice(lineEnd)
        caret = lineEnd + 1 + prefix.length
      }
    }
    setNote(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  /** Enter w liście/zadaniu kontynuuje listę jak w notatkach systemowych. */
  const onNoteKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const el = e.currentTarget
    const { selectionStart: a, value } = el
    const lineStart = value.lastIndexOf('\n', a - 1) + 1
    const line = value.slice(lineStart, a)
    const m = line.match(/^(\s*(?:[-*•]\s+|\[[ xX]\]\s+))(.*)$/)
    if (!m) return
    e.preventDefault()
    if (!m[2].trim()) {
      // pusta pozycja → zakończ listę
      const next = value.slice(0, lineStart) + value.slice(a)
      setNote(next)
      requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart))
      return
    }
    const prefix = m[1].replace(/\[[xX]\]/, '[ ]')
    const next = value.slice(0, a) + '\n' + prefix + value.slice(a)
    setNote(next)
    const caret = a + 1 + prefix.length
    requestAnimationFrame(() => el.setSelectionRange(caret, caret))
  }

  const then = (fn: () => void) => () => {
    primeKeyboard()
    if (save()) fn()
  }

  return (
    <Sheet onClose={done} label="Edycja myśli" tall>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <button style={{ color: 'var(--muted)', fontSize: 15, padding: '6px 0' }} onClick={cancel}>
          Anuluj
        </button>
        <span className="serif" style={{ fontSize: 22 }}>
          {isNew ? (isRoot ? 'Nowe centrum' : 'Nowa myśl') : 'Edycja'}
        </span>
        <button style={{ color: 'var(--gold)', fontSize: 15, fontWeight: 600, padding: '6px 0' }} onClick={done}>
          Gotowe
        </button>
      </div>

      <label className="label" htmlFor="f-title">
        Tytuł
      </label>
      <textarea
        id="f-title"
        ref={titleRef}
        className="field"
        style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3 }}
        rows={1}
        value={title}
        placeholder={isRoot ? 'Główna myśl, pytanie, temat…' : 'Nowa myśl'}
        enterKeyHint="next"
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            noteRef.current?.focus()
          }
        }}
      />

      <label className="label" htmlFor="f-note">
        <span className="pilcrow" style={{ fontSize: 15 }}>
          ¶
        </span>
        Notatka
      </label>
      <div className="field" style={{ padding: 0 }}>
        <textarea
          id="f-note"
          ref={noteRef}
          style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', resize: 'none', padding: '12px 15px 6px', fontSize: 15, lineHeight: 1.5, display: 'block' }}
          value={note}
          placeholder="Opis, argumenty, linki, lista zadań…"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={onNoteKey}
        />
        <div style={{ display: 'flex', gap: 4, borderTop: '1px solid var(--line)', padding: '4px 8px', color: 'var(--muted)' }}>
          {(
            [
              ['bold', IconBold, 'Pogrubienie'],
              ['italic', IconItalic, 'Kursywa'],
              ['list', IconList, 'Lista'],
              ['task', IconCheckbox, 'Zadanie'],
            ] as const
          ).map(([k, Icon, label]) => (
            <button
              key={k}
              aria-label={label}
              style={{ width: 38, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10 }}
              onPointerDown={(e) => e.preventDefault() /* nie zabieraj focusu z notatki */}
              onClick={() => format(k)}
            >
              <Icon size={18} stroke={1.75} />
            </button>
          ))}
        </div>
      </div>

      <div className="label">
        Kolor
        {hasKids && color !== node.color && <span style={{ color: 'var(--faint)' }}>· zmieni też podpunkty w kolorze gałęzi</span>}
        {!hasKids && inherited && color === inherited && <span style={{ color: 'var(--faint)' }}>· kolor gałęzi</span>}
      </div>
      <Swatches value={color} onChange={setColor} />

      <div className="label">Priorytet</div>
      <PriorityPicker value={priority} onChange={setPriority} />

      <div style={{ marginTop: 16 }}>
        <button
          className="toggle-row"
          onClick={() => !isRoot && setAsRoot((v) => !v)}
          role="switch"
          aria-checked={asRoot}
          aria-disabled={isRoot}
        >
          <IconTarget size={20} stroke={1.75} style={{ color: 'var(--gold)', flex: 'none' }} />
          <span style={{ flex: 1 }}>
            <span style={{ fontSize: 14.5, display: 'block' }}>Punkt centralny</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {isRoot ? 'To jest centrum mapy. Podepniesz je, przeciągając na liście.' : 'Odłącz od rodzica razem z podpunktami'}
            </span>
          </span>
          <span className={`switch${asRoot ? ' on' : ''}`} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
        <button className="btn btn-ghost" style={{ flex: 1, padding: '0 10px' }} onClick={then(() => useNous.getState().addChild(id))}>
          <IconCornerDownRight size={18} stroke={1.75} />
          Dziecko
        </button>
        <button className="btn btn-ghost" style={{ flex: 1, padding: '0 10px' }} onClick={then(() => useNous.getState().addSibling(id))}>
          <IconPlus size={18} stroke={1.75} />
          {isRoot ? 'Centrum' : 'Obok'}
        </button>
        {confirmDelete ? (
          <button className="btn btn-danger" onClick={() => s.removeNode(id)} style={{ padding: '0 16px' }}>
            Usunąć?
          </button>
        ) : (
          <button className="btn btn-danger" style={{ width: 50, padding: 0 }} onClick={() => setConfirmDelete(true)} aria-label="Usuń myśl">
            <IconTrash size={18} stroke={1.75} />
          </button>
        )}
      </div>
    </Sheet>
  )
}
