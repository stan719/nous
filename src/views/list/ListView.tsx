import {
  closestCenter,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconChevronDown, IconPlus } from '@tabler/icons-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { PrioBadge } from '../../components/PrioBadge'
import { primeKeyboard } from '../../lib/ios'
import { notePreview } from '../../model/note'
import { useCurrentMap, useNous } from '../../store/useNous'
import { flatten, getProjection, INDENT, type FlatItem } from './flatten'

interface RowProps {
  /** opóźnienie animacji wejścia (kaskada przy otwarciu listy) */
  delay?: number
  item: FlatItem
  depth: number
  rootNo: number
  selected: boolean
  showNotes: boolean
  overlay?: boolean
}

const RowContent = memo(function RowContent({ item, depth, rootNo, selected, showNotes, overlay, delay }: RowProps) {
  const enter = overlay ? '' : ' row-enter'
  const anim = { animationDelay: delay ? `${delay}ms` : undefined }
  const { node, childCount, color } = item
  const s = useNous.getState()
  const cvar = { '--c': color ? `var(--c-${color})` : 'var(--c-none)' } as React.CSSProperties
  const chevron = childCount ? (
    <button
      className={`chev${node.collapsed ? ' closed' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        s.toggleCollapsed(node.id)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={node.collapsed ? 'Rozwiń' : 'Zwiń'}
      aria-expanded={!node.collapsed}
    >
      <IconChevronDown size={15} stroke={2} />
    </button>
  ) : (
    <span className="chev" />
  )
  const preview = showNotes && node.note.trim() ? notePreview(node.note) : ''

  if (depth === 0) {
    return (
      <div className={`root-row${selected ? ' sel' : ''}${overlay ? ' row overlay' : ''}${enter}`} style={{ marginTop: rootNo > 1 ? 14 : 0, ...anim }}>
        <span style={{ marginTop: 18 }}>{chevron}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ color: 'var(--gold)' }}>
            Centrum {rootNo}
          </div>
          <div className="q">{node.title || <span className="empty-title">Punkt centralny</span>}</div>
          {preview && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span className="pilcrow">¶</span>
              {preview}
            </div>
          )}
        </div>
        {node.collapsed && childCount > 0 && <span className="collapsed-badge" style={{ marginTop: 20 }}>{childCount}</span>}
        <span style={{ marginTop: 18 }}>
          <PrioBadge priority={node.priority} />
        </span>
      </div>
    )
  }

  const guides = []
  for (let i = 1; i < depth; i++) guides.push(<span key={i} className="guide" style={{ left: i * INDENT + 6, ...cvar }} />)
  return (
    <div className={`row${selected ? ' sel' : ''}${overlay ? ' overlay' : ''}${enter}`} style={{ paddingLeft: (depth - 1) * INDENT + 6, ...cvar, ...anim }}>
      {!overlay && guides}
      {chevron}
      <span className="dot" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t" style={{ fontWeight: depth === 1 ? 500 : 400 }}>
          {node.title || <span className="empty-title">Nowa myśl</span>}
        </div>
        {preview && (
          <div className="n">
            <span className="pilcrow" style={{ fontSize: 13 }}>
              ¶
            </span>
            {preview}
          </div>
        )}
      </div>
      {node.collapsed && childCount > 0 && <span className="collapsed-badge" style={{ marginTop: 2 }}>{childCount}</span>}
      <span style={{ marginTop: 1 }}>
        <PrioBadge priority={node.priority} />
      </span>
    </div>
  )
})

function SortableRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.item.id })
  const s = useNous.getState()
  return (
    <div
      ref={setNodeRef}
      data-row-id={props.item.id}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      role="treeitem"
      aria-level={props.depth + 1}
      aria-selected={props.selected}
      onClick={() => {
        if (props.selected) s.openSheet({ type: 'preview', id: props.item.id })
        else s.select(props.item.id)
      }}
    >
      <RowContent {...props} />
    </div>
  )
}

export function ListView() {
  const mapId = useNous((s) => s.currentMapId)!
  const map = useCurrentMap()
  const nodes = useNous((s) => s.nodes)
  const selectedId = useNous((s) => s.selectedId)
  const focusRequest = useNous((s) => s.focusRequest)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const mountedAt = useRef(Date.now())

  const items = useMemo(() => flatten(nodes, mapId, activeId), [nodes, mapId, activeId])
  const rootNumbers = useMemo(() => {
    const m = new Map<string, number>()
    items.filter((i) => i.depth === 0).forEach((i, k) => m.set(i.id, k + 1))
    return m
  }, [items])

  const projection = activeId && overId ? getProjection(items, activeId, overId, offsetX) : null

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
  )

  useEffect(() => {
    if (!focusRequest) return
    requestAnimationFrame(() => document.querySelector(`[data-row-id="${focusRequest.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [focusRequest])

  const reset = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetX(0)
  }

  const active = activeId ? items.find((i) => i.id === activeId) : null

  return (
    <div className="list-scroll" data-testid="list" onClick={(e) => e.target === e.currentTarget && useNous.getState().select(null)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={({ active }: DragStartEvent) => {
          setActiveId(String(active.id))
          setOverId(String(active.id))
          navigator.vibrate?.(12)
          useNous.getState().select(String(active.id))
        }}
        onDragMove={({ delta, over }: DragMoveEvent) => {
          setOffsetX(delta.x)
          if (over) setOverId(String(over.id))
        }}
        onDragOver={({ over }) => over && setOverId(String(over.id))}
        onDragEnd={() => {
          if (activeId && projection) useNous.getState().reparent(activeId, projection.parentId, projection.index)
          reset()
        }}
        onDragCancel={reset}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div role="tree" aria-label={map?.title}>
            {items.map((item, i) => (
              <SortableRow
                key={item.id}
                delay={Date.now() - mountedAt.current < 600 ? Math.min(i, 14) * 28 : 0}
                item={item}
                depth={item.id === activeId && projection ? projection.depth : item.depth}
                rootNo={rootNumbers.get(item.id) ?? 0}
                selected={item.id === selectedId}
                showNotes={!!map?.showNotes}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <RowContent item={active} depth={projection?.depth ?? active.depth} rootNo={rootNumbers.get(active.id) ?? 0} selected={false} showNotes={false} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        className="row"
        style={{ color: 'var(--faint)', marginTop: 8, width: '100%', alignItems: 'center' }}
        onClick={() => {
          primeKeyboard()
          useNous.getState().addRoot()
        }}
      >
        <span className="chev" />
        <IconPlus size={16} stroke={1.75} />
        <span style={{ fontSize: 14.5 }}>Nowy punkt centralny</span>
      </button>
    </div>
  )
}
