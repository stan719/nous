import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

/** true, gdy arkusz gra animację zamknięcia (ustawiane przez App) */
export const SheetLeaving = createContext(false)

interface Props {
  /** zamknięcie arkusza — w edycji oznacza „zapisz i zamknij” */
  onClose: () => void
  label: string
  children: ReactNode
  /** arkusz zajmuje prawie cały ekran (edycja) */
  tall?: boolean
}

/** odległość (px) albo prędkość (px/ms), po których puszczony arkusz się zamyka */
const CLOSE_DISTANCE = 110
const CLOSE_VELOCITY = 0.5

/**
 * Dolny arkusz. Zamykany: zsunięciem w dół z dowolnego miejsca (gdy treść jest
 * przewinięta do góry), tapnięciem w tło albo klawiszem Esc.
 */
export function Sheet({ onClose, label, children, tall }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const leaving = useContext(SheetLeaving)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startX = 0
    let startY = 0
    let decided = false
    let active = false
    let dy = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0

    const follow = (d: number) => {
      el.style.transform = `translateY(${d}px)`
      if (scrimRef.current) scrimRef.current.style.opacity = String(Math.max(0.2, 1 - d / 500))
    }
    const release = () => {
      el.style.transition = ''
      if (scrimRef.current) scrimRef.current.style.transition = 'opacity 0.3s'
      if (dy > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && dy > 24)) {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        closeRef.current()
      } else {
        el.style.transform = ''
        if (scrimRef.current) scrimRef.current.style.opacity = ''
      }
    }

    const onStart = (e: TouchEvent) => {
      decided = active = false
      // gest zaczęty na uchwycie obsługują zdarzenia wskaźnika poniżej
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest('.sheet-grab')) return
      startX = e.touches[0].clientX
      startY = lastY = e.touches[0].clientY
      lastT = performance.now()
      decided = active = false
      dy = velocity = 0
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest('.sheet-grab')) return
      const t = e.touches[0]
      if (!decided) {
        const ddx = t.clientX - startX
        const ddy = t.clientY - startY
        if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return
        decided = true
        const target = e.target as HTMLElement
        const body = el.querySelector('.sheet-body')
        const atTop = !body || body.scrollTop <= 0
        // w aktywnym polu tekstowym przeciąganie służy do zaznaczania tekstu
        const field = target.closest('input, textarea')
        const inFocusedField = !!field && field === document.activeElement
        active = ddy > 0 && Math.abs(ddy) > Math.abs(ddx) && atTop && !inFocusedField
        if (!active) return
        startY = t.clientY
        el.style.transition = 'none'
        if (scrimRef.current) scrimRef.current.style.transition = 'none'
      }
      if (!active) return
      e.preventDefault() // przejmujemy gest — bez przewijania treści
      const now = performance.now()
      velocity = (t.clientY - lastY) / Math.max(1, now - lastT)
      lastY = t.clientY
      lastT = now
      dy = Math.max(0, t.clientY - startY)
      follow(dy)
    }
    const onEnd = () => {
      if (active) release()
      decided = active = false
    }

    // uchwyt: przeciąganie palcem albo myszą (zdarzenia wskaźnika)
    const grab = el.querySelector<HTMLElement>('.sheet-grab')
    const onPointerDown = (e: PointerEvent) => {
      try {
        grab?.setPointerCapture(e.pointerId)
      } catch {
        // syntetyczne zdarzenia w testach
      }
      startY = lastY = e.clientY
      lastT = performance.now()
      active = true
      dy = velocity = 0
      el.style.transition = 'none'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!active) return
      const now = performance.now()
      velocity = (e.clientY - lastY) / Math.max(1, now - lastT)
      lastY = e.clientY
      lastT = now
      dy = Math.max(0, e.clientY - startY)
      follow(dy)
    }
    const onPointerUp = () => {
      if (!active) return
      active = false
      release()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    grab?.addEventListener('pointerdown', onPointerDown)
    grab?.addEventListener('pointermove', onPointerMove)
    grab?.addEventListener('pointerup', onPointerUp)
    grab?.addEventListener('pointercancel', onPointerUp)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      grab?.removeEventListener('pointerdown', onPointerDown)
      grab?.removeEventListener('pointermove', onPointerMove)
      grab?.removeEventListener('pointerup', onPointerUp)
      grab?.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  return (
    <>
      <div ref={scrimRef} className={`scrim${leaving ? ' leaving' : ''}`} onClick={() => closeRef.current()} data-ui />
      <div
        ref={ref}
        className={`sheet${leaving ? ' leaving' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-ui
        style={tall ? { height: 'calc(var(--app-h) - var(--kb) - var(--safe-top) - 24px)' } : undefined}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-body" style={tall ? { flex: 1 } : undefined}>
          {children}
        </div>
      </div>
    </>
  )
}
