import { memo } from 'react'
import { PrioBadge } from '../../components/PrioBadge'
import { notePreview } from '../../model/note'
import type { VisibleNode } from './graph'

interface Props {
  v: VisibleNode
  x: number
  y: number
  compact: boolean
  selected: boolean
  dragging: boolean
  /** węzeł trzymany palcem (podniesiony) */
  lifted?: boolean
  /** palec właśnie dotknął węzła */
  pressed?: boolean
  enter?: 'bloom' | 'pop'
}

const colorVar = (c: string | null) => ({ '--c': c ? `var(--c-${c})` : 'var(--c-none)' }) as React.CSSProperties

function Title({ text }: { text: string }) {
  return text.trim() ? <>{text}</> : <span className="empty-title">Nowa myśl</span>
}

export const NodeCard = memo(function NodeCard({ v, x, y, compact, selected, dragging, lifted, pressed, enter }: Props) {
  const { node, depth, label, color, hiddenCount } = v
  const cls = `node${selected ? ' sel' : ''}${dragging ? ' dragging' : ''}${lifted ? ' lifted' : ''}${pressed ? ' pressed' : ''}${enter ? ` enter-${enter}` : ''}`
  const style = { left: x, top: y, ...colorVar(color), animationDelay: enter === 'bloom' ? `${Math.min(depth, 5) * 70}ms` : undefined }
  const hasNote = !!node.note.trim()
  const collapsed = hiddenCount > 0 ? <span className="collapsed-badge">+{hiddenCount}</span> : null

  if (depth === 0) {
    return (
      <div className={`${cls} node-root${selected ? ' sel' : ''}${node.title.trim() ? '' : ' empty'}`} style={style} data-node-id={node.id}>
        <span className="eyebrow">{label}</span>
        {node.title.trim() || 'Punkt centralny'}
        {collapsed && <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>{collapsed}</div>}
      </div>
    )
  }

  if (!compact && (hasNote || depth === 1)) {
    return (
      <div className={`${cls} node-card${selected ? ' sel' : ''}`} style={style} data-node-id={node.id}>
        <div className="meta">
          <span className="dot" />
          {label ?? (hasNote ? <span className="pilcrow" style={{ letterSpacing: 0 }}>¶</span> : null)}
          {collapsed}
          <PrioBadge priority={node.priority} />
        </div>
        <div className="title">
          <Title text={node.title} />
        </div>
        {hasNote && (
          <div className="note">
            {label && <span className="pilcrow">¶</span>}
            {notePreview(node.note)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`${cls} node-chip${depth === 1 ? ' branch' : ''}${selected ? ' sel' : ''}`} style={style} data-node-id={node.id}>
      <span className="dot" />
      <span className="t">
        <Title text={node.title} />
      </span>
      {hasNote && <span className="pm">¶</span>}
      {collapsed}
      <PrioBadge priority={node.priority} />
    </div>
  )
})
