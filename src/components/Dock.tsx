import {
  IconChevronsDown,
  IconChevronsUp,
  IconCornerDownRight,
  IconDots,
  IconEye,
  IconHierarchy3,
  IconIndentDecrease,
  IconIndentIncrease,
  IconListTree,
  IconPencil,
  IconPlus,
  IconTarget,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { primeKeyboard } from '../lib/ios'
import { childrenOf, effectiveColor } from '../model/tree'
import { useNous } from '../store/useNous'
import { Swatches } from './Swatches'

export function Dock() {
  const selectedId = useNous((s) => s.selectedId)
  const exists = useNous((s) => !!(s.selectedId && s.nodes[s.selectedId]))
  const view = useNous((s) => s.view)
  if (selectedId && exists) return <ContextDock id={selectedId} key={selectedId} />
  return <MainDock view={view} />
}

function MainDock({ view }: { view: 'canvas' | 'list' }) {
  const s = useNous.getState()
  const segRef = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null)

  // pigułka pod aktywną zakładką — pozycja mierzona z przycisków
  useLayoutEffect(() => {
    const btn = segRef.current?.querySelector<HTMLElement>('button.on')
    if (btn) setInd({ x: btn.offsetLeft, w: btn.offsetWidth })
  }, [view])

  return (
    <nav className="dock" data-ui aria-label="Widok">
      <div className="segmented" role="tablist" ref={segRef}>
        {ind && <span className="seg-indicator" style={{ translate: `${ind.x}px 0`, width: ind.w }} aria-hidden="true" />}
        <button className={view === 'canvas' ? 'on' : ''} onClick={() => s.setView('canvas')} role="tab" aria-selected={view === 'canvas'}>
          <IconHierarchy3 size={16} stroke={1.75} />
          Kanwa
        </button>
        <button className={view === 'list' ? 'on' : ''} onClick={() => s.setView('list')} role="tab" aria-selected={view === 'list'}>
          <IconListTree size={16} stroke={1.75} />
          Lista
        </button>
      </div>
      <button
        className="fab"
        aria-label="Nowy punkt centralny"
        onClick={() => {
          primeKeyboard()
          s.addRoot()
        }}
      >
        <IconPlus size={22} stroke={2} />
      </button>
    </nav>
  )
}

function ContextDock({ id }: { id: string }) {
  const node = useNous((s) => s.nodes[id])
  const color = useNous((s) => effectiveColor(s.nodes, id))
  const hasChildren = useNous((s) => childrenOf(s.nodes, id, s.nodes[id]?.mapId ?? '').length > 0)
  const view = useNous((s) => s.view)
  const [panel, setPanel] = useState<null | 'color' | 'more'>(null)
  const s = useNous.getState()

  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && (panel ? setPanel(null) : s.select(null))
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [panel, s])

  if (!node) return null
  const isRoot = node.parentId === null
  const act = (fn: () => void) => () => {
    setPanel(null)
    fn()
  }
  const withKeyboard = (fn: () => void) => () => {
    primeKeyboard()
    setPanel(null)
    fn()
  }

  return (
    <>
      {panel && <div style={{ position: 'fixed', inset: 0, zIndex: 24 }} onClick={() => setPanel(null)} data-ui />}
      {panel === 'color' && (
        <div className="popover" data-ui style={{ left: 16, right: 16, bottom: 'calc(max(16px, var(--safe-bottom)) + 76px)', padding: 14 }}>
          <Swatches
            value={node.color}
            onChange={(c) => {
              s.updateNode(id, { color: c })
              setPanel(null)
            }}
          />
        </div>
      )}
      {panel === 'more' && (
        <div className="popover" data-ui style={{ right: 16, bottom: 'calc(max(16px, var(--safe-bottom)) + 76px)' }}>
          <button onClick={act(() => s.openSheet({ type: 'preview', id }))}>
            <IconEye size={19} stroke={1.75} />
            Podgląd
          </button>
          {hasChildren && (
            <button onClick={act(() => s.toggleCollapsed(id))}>
              {node.collapsed ? <IconChevronsDown size={19} stroke={1.75} /> : <IconChevronsUp size={19} stroke={1.75} />}
              {node.collapsed ? 'Rozwiń gałąź' : 'Zwiń gałąź'}
            </button>
          )}
          {view === 'list' && !isRoot && (
            <>
              <button onClick={act(() => s.indent(id))}>
                <IconIndentIncrease size={19} stroke={1.75} />
                Wcięcie
              </button>
              <button onClick={act(() => s.outdent(id))}>
                <IconIndentDecrease size={19} stroke={1.75} />
                Cofnij wcięcie
              </button>
            </>
          )}
          {!isRoot && (
            <button onClick={act(() => s.detachAsRoot(id))}>
              <IconTarget size={19} stroke={1.75} />
              Ustaw jako punkt centralny
            </button>
          )}
          <button onClick={act(() => s.removeNode(id))} style={{ color: 'var(--alert)' }}>
            <IconTrash size={19} stroke={1.75} style={{ color: 'var(--alert)' }} />
            Usuń
          </button>
        </div>
      )}
      <nav className="dock" data-ui aria-label="Akcje węzła" style={{ padding: '0 6px' }}>
        <button className="ctx-action" onClick={withKeyboard(() => s.addChild(id))}>
          <IconCornerDownRight size={20} stroke={1.75} />
          Dziecko
        </button>
        <button className="ctx-action" onClick={withKeyboard(() => s.addSibling(id))}>
          <IconPlus size={20} stroke={1.75} />
          {isRoot ? 'Centrum' : 'Obok'}
        </button>
        <button className="ctx-action" onClick={() => setPanel(panel === 'color' ? null : 'color')} aria-expanded={panel === 'color'}>
          <span className="swatch-dot" style={{ '--c': color ? `var(--c-${color})` : 'transparent' } as React.CSSProperties} />
          Kolor
        </button>
        <button className="ctx-action" onClick={withKeyboard(() => s.openSheet({ type: 'edit', id }))}>
          <IconPencil size={20} stroke={1.75} />
          Edytuj
        </button>
        <button className="ctx-action" onClick={() => setPanel(panel === 'more' ? null : 'more')} aria-expanded={panel === 'more'}>
          <IconDots size={20} stroke={1.75} />
          Więcej
        </button>
      </nav>
    </>
  )
}
