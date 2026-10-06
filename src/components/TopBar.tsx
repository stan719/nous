import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronDown,
  IconDots,
  IconFileTypePdf,
  IconFocusCentered,
  IconLayoutDistributeVertical,
  IconMap2,
  IconSearch,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { emit } from '../lib/events'
import { plural } from '../model/numerals'
import { mapNodes } from '../model/tree'
import { useCurrentMap, useNous } from '../store/useNous'

export function TopBar() {
  const map = useCurrentMap()
  const nodes = useNous((s) => s.nodes)
  const view = useNous((s) => s.view)
  const canUndo = useStore(useNous.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useNous.temporal, (s) => s.futureStates.length > 0)
  const [menu, setMenu] = useState(false)

  const counts = useMemo(() => {
    if (!map) return { all: 0, roots: 0 }
    const list = mapNodes(nodes, map.id)
    return { all: list.length, roots: list.filter((n) => n.parentId === null).length }
  }, [nodes, map])

  if (!map) return null
  const s = useNous.getState()
  const act = (fn: () => void) => () => {
    setMenu(false)
    fn()
  }

  return (
    <header className="topbar" data-ui>
      <div style={{ minWidth: 0, flex: 1 }}>
        <button
          className="serif"
          style={{ fontSize: map.title.length > 11 ? 27 : 33, lineHeight: 1.05, minHeight: 35, display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}
          onClick={() => s.openSheet({ type: 'maps' })}
          aria-label={`Mapa: ${map.title}. Pokaż wszystkie mapy`}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{map.title}</span>
          <IconChevronDown size={17} stroke={1.75} style={{ color: 'var(--muted)', marginTop: 6, flex: 'none' }} />
        </button>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 7, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-sage)' }} />
          {counts.all} {plural(counts.all, ['myśl', 'myśli', 'myśli'])} · {counts.roots}{' '}
          {plural(counts.roots, ['centrum', 'centra', 'centrów'])}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        <button
          className={`icon-btn${map.showNotes ? ' on' : ''}`}
          onClick={s.toggleNotes}
          aria-pressed={map.showNotes}
          aria-label={map.showNotes ? 'Ukryj notatki' : 'Pokaż notatki'}
          style={{ fontFamily: 'var(--serif)', fontSize: 22 }}
        >
          ¶
        </button>
        <button className="icon-btn" onClick={() => s.openSheet({ type: 'search' })} aria-label="Szukaj">
          <IconSearch size={19} stroke={1.75} />
        </button>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
          <IconDots size={19} stroke={1.75} />
        </button>
      </div>
      {menu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onClick={() => setMenu(false)} />
          <div className="popover" style={{ right: 16, top: 'calc(var(--safe-top) + 62px)' }}>
            <button onClick={act(s.undo)} disabled={!canUndo}>
              <IconArrowBackUp size={19} stroke={1.75} />
              Cofnij
            </button>
            <button onClick={act(s.redo)} disabled={!canRedo}>
              <IconArrowForwardUp size={19} stroke={1.75} />
              Ponów
            </button>
            {view === 'canvas' && (
              <>
                <button onClick={act(() => emit('fit'))}>
                  <IconFocusCentered size={19} stroke={1.75} />
                  Wyśrodkuj widok
                </button>
                <button onClick={act(s.tidyMap)}>
                  <IconLayoutDistributeVertical size={19} stroke={1.75} />
                  Uporządkuj mapę
                </button>
              </>
            )}
            <button onClick={act(() => s.openSheet({ type: 'pdf' }))}>
              <IconFileTypePdf size={19} stroke={1.75} />
              Eksportuj do PDF
            </button>
            <button onClick={act(() => s.openSheet({ type: 'maps' }))}>
              <IconMap2 size={19} stroke={1.75} />
              Twoje mapy i kopia
            </button>
          </div>
        </>
      )}
    </header>
  )
}
