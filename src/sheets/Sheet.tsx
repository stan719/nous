import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

/** true, gdy arkusz gra animację zamknięcia (ustawiane przez App) */
export const SheetLeaving = createContext(false)

interface Props {
  onClose: () => void
  label: string
  children: ReactNode
  /** arkusz zajmuje prawie cały ekran (edycja) */
  tall?: boolean
}

/** Dolny arkusz: zamykany tapnięciem w tło, przeciągnięciem uchwytu w dół lub klawiszem Esc. */
export function Sheet({ onClose, label, children, tall }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const leaving = useContext(SheetLeaving)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, dy: 0 }
    if (ref.current) ref.current.style.transition = 'none'
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    ref.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!ref.current || !d) return
    ref.current.style.transition = ''
    if (d.dy > 90) onClose()
    else ref.current.style.transform = ''
  }

  return (
    <>
      <div className={`scrim${leaving ? ' leaving' : ''}`} onClick={onClose} data-ui />
      <div
        ref={ref}
        className={`sheet${leaving ? ' leaving' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-ui
        style={tall ? { height: 'calc(100dvh - var(--kb) - var(--safe-top) - 24px)' } : undefined}
      >
        <div className="sheet-grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        <div className="sheet-body" style={tall ? { flex: 1 } : undefined}>
          {children}
        </div>
      </div>
    </>
  )
}
