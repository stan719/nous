import { IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { notePreview } from '../model/note'
import { effectiveColor, pathOf } from '../model/tree'
import { useNous } from '../store/useNous'
import { Sheet } from './Sheet'

const norm = (s: string) => s.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function SearchSheet() {
  const nodes = useNous((s) => s.nodes)
  const maps = useNous((s) => s.maps)
  const currentMapId = useNous((s) => s.currentMapId)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30)
    return () => clearTimeout(t)
  }, [])

  const results = useMemo(() => {
    const nq = norm(q.trim())
    if (!nq) return []
    return Object.values(nodes)
      .map((n) => {
        const inTitle = norm(n.title).includes(nq)
        const inNote = norm(n.note).includes(nq)
        return { n, score: (inTitle ? 2 : 0) + (inNote ? 1 : 0) + (n.mapId === currentMapId ? 0.5 : 0) }
      })
      .filter((r) => r.score >= 1)
      .sort((a, b) => b.score - a.score || b.n.updatedAt - a.n.updatedAt)
      .slice(0, 40)
  }, [q, nodes, currentMapId])

  return (
    <Sheet onClose={useNous.getState().closeSheet} label="Szukaj" tall>
      <div style={{ position: 'relative' }}>
        <IconSearch size={18} stroke={1.75} style={{ position: 'absolute', left: 15, top: 15, color: 'var(--muted)' }} />
        <input
          ref={inputRef}
          className="field"
          style={{ paddingLeft: 42, borderRadius: 999 }}
          placeholder="Szukaj w tytułach i notatkach"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
          aria-label="Szukaj"
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {q.trim() && !results.length && <div style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 4px' }}>Nic nie znaleziono.</div>}
        {results.map(({ n }) => {
          const c = effectiveColor(nodes, n.id)
          const path = pathOf(nodes, n.id)
            .slice(0, -1)
            .map((p) => p.title || 'Nowa myśl')
            .join(' › ')
          return (
            <button
              key={n.id}
              className="row"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => useNous.getState().focusNode(n.id)}
            >
              <span className="dot" style={{ '--c': `var(--c-${c ?? 'none'})` } as React.CSSProperties} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t" style={{ display: 'block' }}>
                  {n.title || 'Nowa myśl'}
                </span>
                <span className="n" style={{ display: 'block' }}>
                  {n.mapId !== currentMapId ? `${maps[n.mapId]?.title} · ` : ''}
                  {path || 'punkt centralny'}
                </span>
                {n.note && norm(n.note).includes(norm(q.trim())) && (
                  <span className="n" style={{ display: 'block', color: 'var(--faint)' }}>
                    <span className="pilcrow">¶</span>
                    {notePreview(n.note)}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
