import { IconCornerDownRight, IconPencil, IconSubtask } from '@tabler/icons-react'
import { PrioBadge } from '../components/PrioBadge'
import { primeKeyboard } from '../lib/ios'
import { toggleTask } from '../model/note'
import { childrenOf, effectiveColor, nodeLabel, pathOf } from '../model/tree'
import { COLOR_NAMES, PRIORITY_NAMES } from '../model/types'
import { NoteView } from '../components/NoteView'
import { useNous } from '../store/useNous'
import { Sheet } from './Sheet'

export function PreviewSheet({ id }: { id: string }) {
  const nodes = useNous((s) => s.nodes)
  const node = nodes[id]
  const s = useNous.getState()
  if (!node) return null

  const color = effectiveColor(nodes, id)
  const kids = childrenOf(nodes, id, node.mapId)
  const crumb = pathOf(nodes, id)
    .map((n) => nodeLabel(nodes, n.id))
    .filter(Boolean)
    .join(' · ')
  const parentTitle = node.parentId ? nodes[node.parentId]?.title : null

  return (
    <Sheet onClose={s.closeSheet} label="Podgląd myśli">
      <div className="eyebrow" style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
        <span className="dot" style={{ '--c': color ? `var(--c-${color})` : undefined } as React.CSSProperties} />
        {crumb || (parentTitle ? `w: ${parentTitle}` : 'Myśl')}
      </div>
      <h2 className="serif" style={{ fontSize: 29, lineHeight: 1.1, marginTop: 10, overflowWrap: 'anywhere' }}>
        {node.title.trim() || <span style={{ color: 'var(--faint)' }}>Bez tytułu</span>}
      </h2>

      <div style={{ display: 'flex', gap: 7, marginTop: 14, flexWrap: 'wrap' }}>
        {node.priority > 0 && (
          <span className="meta-chip">
            <PrioBadge priority={node.priority} />
            {PRIORITY_NAMES[node.priority]}
          </span>
        )}
        {color && (
          <span className="meta-chip">
            <span className="dot" style={{ '--c': `var(--c-${color})` } as React.CSSProperties} />
            {COLOR_NAMES[color]}
            {!node.color && ' (z gałęzi)'}
          </span>
        )}
        {kids.length > 0 && (
          <span className="meta-chip">
            <IconSubtask size={15} stroke={1.75} />
            {kids.length} {kids.length === 1 ? 'podpunkt' : kids.length < 5 ? 'podpunkty' : 'podpunktów'}
          </span>
        )}
      </div>

      <div className="label">
        <span className="pilcrow" style={{ fontSize: 15 }}>
          ¶
        </span>
        Notatka
      </div>
      {node.note.trim() ? (
        <NoteView note={node.note} onToggleTask={(line) => s.updateNode(id, { note: toggleTask(node.note, line) })} />
      ) : (
        <button
          className="prose"
          style={{ color: 'var(--faint)', textAlign: 'left' }}
          onClick={() => {
            primeKeyboard()
            s.openSheet({ type: 'edit', id })
          }}
        >
          Brak notatki — dotknij, aby dodać opis.
        </button>
      )}

      {kids.length > 0 && (
        <>
          <div className="label">Podpunkty</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {kids.map((k) => (
              <button
                key={k.id}
                className="meta-chip"
                style={{ color: 'var(--ink)', maxWidth: '100%' }}
                onClick={() => {
                  s.select(k.id)
                  s.openSheet({ type: 'preview', id: k.id })
                }}
              >
                <span className="dot" style={{ '--c': `var(--c-${effectiveColor(nodes, k.id) ?? 'none'})` } as React.CSSProperties} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.title || 'Nowa myśl'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={() => {
            primeKeyboard()
            s.openSheet({ type: 'edit', id })
          }}
        >
          <IconPencil size={18} stroke={1.75} />
          Edytuj
        </button>
        <button
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={() => {
            primeKeyboard()
            s.addChild(id)
          }}
        >
          <IconCornerDownRight size={18} stroke={1.75} />
          Dziecko
        </button>
      </div>
    </Sheet>
  )
}
