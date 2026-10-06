import { IconCheck } from '@tabler/icons-react'
import { Fragment, type ReactNode } from 'react'
import { parseNote, type Block, type Inline } from '../model/note'

function InlineText({ inline }: { inline: Inline[] }) {
  return (
    <>
      {inline.map((i, k) =>
        i.bold ? (
          <strong key={k} style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {i.text}
          </strong>
        ) : i.italic ? (
          <em key={k}>{i.text}</em>
        ) : (
          <Fragment key={k}>{i.text}</Fragment>
        ),
      )}
    </>
  )
}

/** Notatka w trybie czytania; zadania można odhaczać bez wchodzenia w edycję. */
export function NoteView({ note, onToggleTask }: { note: string; onToggleTask?: (line: number) => void }) {
  const blocks = parseNote(note)
  const out: ReactNode[] = []
  let list: Block[] = []
  const flush = () => {
    if (!list.length) return
    out.push(
      <ul key={`ul${out.length}`}>
        {list.map((b, i) =>
          b.type === 'task' ? (
            <li key={i} className={`task${b.done ? ' done' : ''}`}>
              <button
                className={`task-box${b.done ? ' on' : ''}`}
                onClick={() => onToggleTask?.(b.line)}
                role="checkbox"
                aria-checked={b.done}
                aria-label={b.done ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'}
              >
                {b.done && <IconCheck size={14} stroke={2.5} />}
              </button>
              <span>
                <InlineText inline={b.inline} />
              </span>
            </li>
          ) : b.type === 'li' ? (
            <li key={i} className="bullet">
              <InlineText inline={b.inline} />
            </li>
          ) : null,
        )}
      </ul>,
    )
    list = []
  }
  for (const b of blocks) {
    if (b.type === 'li' || b.type === 'task') list.push(b)
    else {
      flush()
      if (b.type === 'p')
        out.push(
          <p key={`p${out.length}`}>
            <InlineText inline={b.inline} />
          </p>,
        )
    }
  }
  flush()
  return <div className="prose">{out}</div>
}
