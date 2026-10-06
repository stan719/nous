import { IconFocusCentered, IconLayoutDistributeVertical, IconTarget } from '@tabler/icons-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { on } from '../../lib/events'
import { haptic } from '../../lib/haptics'
import { primeKeyboard } from '../../lib/ios'
import { reducedMotion, springOut, tween } from '../../lib/motion'
import { boundsOf } from '../../model/layout'
import { descendantIds } from '../../model/tree'
import type { Viewport } from '../../model/types'
import { useCurrentMap, useNous } from '../../store/useNous'
import { Edges } from './Edges'
import { visibleGraph } from './graph'
import { NodeCard } from './NodeCard'
import { useAnimatedPositions } from './useAnimatedPositions'

const MIN_K = 0.25
const MAX_K = 2.5
const COMPACT_BELOW = 0.6
/** po tylu ms przytrzymany węzeł „podnosi się” do przeciągania */
const HOLD_MS = 260
const MOVE_SLOP = 8
/** palec na węźle może lekko drgnąć, zanim uznamy to za przesuwanie kanwy */
const NODE_SLOP = 12
/** iOS-owe wyhamowanie bezwładności: prędkość mnożona przez 0.997 co milisekundę */
const DECEL = 0.997
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k))

/** Obszar widoczny między górnym paskiem a dockiem (w pikselach ekranu). */
function safeArea(el: HTMLElement) {
  const cs = getComputedStyle(document.documentElement)
  const top = parseFloat(cs.getPropertyValue('--safe-top')) || 0
  const bottom = parseFloat(cs.getPropertyValue('--safe-bottom')) || 0
  const w = el.clientWidth
  const h = el.clientHeight
  // dock stoi na wysokości --dock-bottom (patrz index.css) i ma 64 px
  const dockTop = h - Math.max(10, bottom - 20) - 64
  return { left: 16, right: w - 16, top: top + 110, bottom: dockTop - 12 }
}

type Gesture =
  | { mode: 'idle' }
  | { mode: 'pending'; sx: number; sy: number; nodeId: string | null; timer: number }
  | { mode: 'pan'; lx: number; ly: number; samples: { x: number; y: number; t: number }[] }
  | { mode: 'drag'; sx: number; sy: number; nodeId: string }
  | { mode: 'pinch'; dist: number; mx: number; my: number; k: number; x: number; y: number }
  | { mode: 'menu' }

interface Drag {
  id: string
  ids: Set<string>
  dx: number
  dy: number
}

export function CanvasView() {
  const mapId = useNous((s) => s.currentMapId)!
  const map = useCurrentMap()
  const nodes = useNous((s) => s.nodes)
  const selectedId = useNous((s) => s.selectedId)
  const focusRequest = useNous((s) => s.focusRequest)

  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const vp = useRef<Viewport>({ x: 0, y: 0, k: 1 })
  const gesture = useRef<Gesture>({ mode: 'idle' })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const lastTap = useRef({ t: 0, x: 0, y: 0 })
  const wheelTimer = useRef(0)
  /** bieżąca animacja widoku (tween albo bezwładność) — przerywana dotknięciem */
  const vpAnim = useRef<() => void>(() => {})
  const mountedAt = useRef(Date.now())

  const [k, setK] = useState(1)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [menu, setMenu] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)

  const list = useMemo(() => visibleGraph(nodes, mapId), [nodes, mapId])
  const compact = !map?.showNotes || k < COMPACT_BELOW

  // ---------- viewport ----------
  // zdarzenia wskaźnika przychodzą już w rytmie klatek, więc styl ustawiamy od razu
  const apply = useCallback(() => {
    const { x, y, k } = vp.current
    if (worldRef.current) worldRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`
    const c = containerRef.current
    if (c) {
      const s = 24 * k
      c.style.backgroundSize = `${s}px ${s}px`
      c.style.backgroundPosition = `${x}px ${y}px`
    }
  }, [])

  const commit = useCallback(() => {
    setK(vp.current.k)
    useNous.getState().setViewport(mapId, { ...vp.current })
  }, [mapId])

  const animateTo = useCallback(
    (next: Viewport) => {
      vpAnim.current()
      const from = { ...vp.current }
      // skala interpolowana logarytmicznie — zoom wygląda równomiernie
      const lk0 = Math.log(from.k)
      const lk1 = Math.log(next.k)
      vpAnim.current = tween({
        duration: 560,
        ease: springOut,
        onUpdate: (p) => {
          vp.current = { x: from.x + (next.x - from.x) * p, y: from.y + (next.y - from.y) * p, k: Math.exp(lk0 + (lk1 - lk0) * p) }
          apply()
        },
        onDone: commit,
      })
    },
    [apply, commit],
  )

  /** Bezwładność po puszczeniu palca — kanwa sunie dalej i łagodnie wyhamowuje. */
  const glide = useCallback(
    (vx: number, vy: number) => {
      vpAnim.current()
      if (reducedMotion() || Math.hypot(vx, vy) < 0.15) return commit()
      let raf = 0
      let last = performance.now()
      let stopped = false
      const stop = () => {
        if (stopped) return
        stopped = true
        cancelAnimationFrame(raf)
        commit()
      }
      const frame = (now: number) => {
        const dt = Math.min(32, now - last)
        last = now
        vp.current.x += vx * dt
        vp.current.y += vy * dt
        const f = Math.pow(DECEL, dt)
        vx *= f
        vy *= f
        apply()
        if (Math.hypot(vx, vy) > 0.02) raf = requestAnimationFrame(frame)
        else stop()
      }
      raf = requestAnimationFrame(frame)
      vpAnim.current = stop
    },
    [apply, commit],
  )

  const fit = useCallback(
    (animate = true) => {
      const el = containerRef.current
      const b = boundsOf(list.map((v) => v.node))
      if (!el || !b) return
      const a = safeArea(el)
      const pad = 24
      const k = clampK(Math.min((a.right - a.left - pad) / (b.maxX - b.minX), (a.bottom - a.top - pad) / (b.maxY - b.minY), 1.1))
      const next = {
        k,
        x: (a.left + a.right) / 2 - ((b.minX + b.maxX) / 2) * k,
        y: (a.top + a.bottom) / 2 - ((b.minY + b.maxY) / 2) * k,
      }
      if (animate) animateTo(next)
      else {
        vp.current = next
        apply()
        commit()
      }
    },
    [list, animateTo, apply, commit],
  )

  const centerOn = useCallback(
    (id: string, minK = 0.8) => {
      const el = containerRef.current
      const n = useNous.getState().nodes[id]
      if (!el || !n) return
      const a = safeArea(el)
      const k = Math.max(vp.current.k, minK)
      animateTo({ k, x: (a.left + a.right) / 2 - n.x * k, y: (a.top + a.bottom) / 2 - n.y * k })
    },
    [animateTo],
  )

  // nowa mapa → przywróć zapisany widok albo dopasuj
  useLayoutEffect(() => {
    const saved = useNous.getState().viewports[mapId]
    if (saved) {
      vp.current = { ...saved }
      setK(saved.k)
      apply()
    } else {
      fit(false)
      // na telefonie cała mapa bywa zbyt mała — wtedy zacznij od pierwszego centrum w czytelnej skali
      const first = list.find((v) => v.depth === 0)?.node
      const el = containerRef.current
      if (first && el && vp.current.k < 0.7) {
        const a = safeArea(el)
        vp.current = { k: 0.8, x: (a.left + a.right) / 2 - first.x * 0.8, y: a.top + 70 - first.y * 0.8 }
        apply()
        commit()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId])

  useEffect(() => on('fit', () => fit()), [fit])

  // otwarcie arkusza albo zaznaczenie zamyka menu przytrzymania
  const sheetOpen = useNous((s) => !!s.sheet)
  useEffect(() => {
    if (sheetOpen || selectedId) setMenu(null)
  }, [sheetOpen, selectedId])

  useEffect(() => {
    if (focusRequest && useNous.getState().nodes[focusRequest.id]?.mapId === mapId) centerOn(focusRequest.id)
  }, [focusRequest, mapId, centerOn])

  // świeżo utworzona myśl poza ekranem (albo pod dockiem) → przesuń kanwę tylko o tyle,
  // ile trzeba, żeby ją pokazać. Zwykłe stuknięcie w węzeł nigdy nie rusza kanwy.
  useEffect(() => {
    const el = containerRef.current
    const n = selectedId ? useNous.getState().nodes[selectedId] : null
    if (!el || !n || n.createdAt < mountedAt.current || Date.now() - n.createdAt > 1500) return
    const a = safeArea(el)
    const { x, y, k } = vp.current
    const sx = n.x * k + x
    const sy = n.y * k + y
    const m = 70 * k
    const dx = sx < a.left + m ? a.left + m - sx : sx > a.right - m ? a.right - m - sx : 0
    const dy = sy < a.top + m ? a.top + m - sy : sy > a.bottom - m ? a.bottom - m - sy : 0
    if (dx || dy) animateTo({ k, x: x + dx, y: y + dy })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ---------- gesty ----------
  const toWorld = (sx: number, sy: number) => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: (sx - r.left - vp.current.x) / vp.current.k, y: (sy - r.top - vp.current.y) / vp.current.k }
  }

  const startPinch = () => {
    const [p1, p2] = [...pointers.current.values()]
    const r = containerRef.current!.getBoundingClientRect()
    gesture.current = {
      mode: 'pinch',
      dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
      mx: (p1.x + p2.x) / 2 - r.left,
      my: (p1.y + p2.y) / 2 - r.top,
      ...vp.current,
    }
  }

  const startDrag = (nodeId: string, sx: number, sy: number) => {
    const ids = new Set([nodeId, ...descendantIds(useNous.getState().nodes, nodeId)])
    gesture.current = { mode: 'drag', sx, sy, nodeId }
    useNous.getState().select(nodeId)
    dragRef.current = { id: nodeId, ids, dx: 0, dy: 0 }
    setDrag(dragRef.current)
    setPressedId(null)
  }

  const onHold = () => {
    const g = gesture.current
    if (g.mode !== 'pending') return
    haptic()
    if (g.nodeId) {
      startDrag(g.nodeId, g.sx, g.sy)
    } else {
      gesture.current = { mode: 'menu' }
      const r = containerRef.current!.getBoundingClientRect()
      const w = toWorld(g.sx, g.sy)
      useNous.getState().select(null)
      setMenu({ sx: g.sx - r.left, sy: g.sy - r.top, wx: w.x, wy: w.y })
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-ui]')) return
    try {
      containerRef.current!.setPointerCapture(e.pointerId)
    } catch {
      // syntetyczne zdarzenia (testy) nie mają aktywnego wskaźnika
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    vpAnim.current() // dotknięcie zatrzymuje sunącą kanwę
    const g = gesture.current
    if (pointers.current.size === 1) {
      setMenu(null)
      const nodeEl = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
      // natychmiastowa reakcja: węzeł lekko się wciska, zanim zacznie się przeciąganie
      if (nodeEl?.dataset.nodeId) setPressedId(nodeEl.dataset.nodeId)
      gesture.current = {
        mode: 'pending',
        sx: e.clientX,
        sy: e.clientY,
        nodeId: nodeEl?.dataset.nodeId ?? null,
        timer: window.setTimeout(onHold, HOLD_MS),
      }
    } else if (pointers.current.size === 2 && g.mode !== 'drag') {
      if (g.mode === 'pending') clearTimeout(g.timer)
      setMenu(null)
      setPressedId(null)
      startPinch()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    const g = gesture.current
    switch (g.mode) {
      case 'pending': {
        const dist = Math.hypot(e.clientX - g.sx, e.clientY - g.sy)
        if (dist > (g.nodeId ? NODE_SLOP : MOVE_SLOP)) {
          clearTimeout(g.timer)
          setPressedId(null)
          // zaznaczony węzeł przeciąga się od razu, bez przytrzymania
          if (g.nodeId && g.nodeId === useNous.getState().selectedId) {
            startDrag(g.nodeId, g.sx, g.sy)
          } else {
            gesture.current = { mode: 'pan', lx: g.sx, ly: g.sy, samples: [] }
          }
          onPointerMove(e)
        }
        break
      }
      case 'pan': {
        vp.current.x += e.clientX - g.lx
        vp.current.y += e.clientY - g.ly
        g.lx = e.clientX
        g.ly = e.clientY
        const t = performance.now()
        g.samples.push({ x: e.clientX, y: e.clientY, t })
        while (g.samples.length > 2 && t - g.samples[0].t > 90) g.samples.shift()
        apply()
        break
      }
      case 'drag': {
        const k = vp.current.k
        const dx = (e.clientX - g.sx) / k
        const dy = (e.clientY - g.sy) / k
        if (dragRef.current) {
          dragRef.current = { ...dragRef.current, dx, dy }
          setDrag(dragRef.current)
        }
        break
      }
      case 'pinch': {
        if (pointers.current.size < 2) break
        const [p1, p2] = [...pointers.current.values()]
        const r = containerRef.current!.getBoundingClientRect()
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
        const mx = (p1.x + p2.x) / 2 - r.left
        const my = (p1.y + p2.y) / 2 - r.top
        const k = clampK((g.k * dist) / g.dist)
        // punkt świata, który był pod środkiem gestu, zostaje pod palcami
        const wx = (g.mx - g.x) / g.k
        const wy = (g.my - g.y) / g.k
        vp.current = { k, x: mx - wx * k, y: my - wy * k }
        apply()
        setK(k)
        break
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    const s = useNous.getState()
    setPressedId(null)

    if (g.mode === 'pending') {
      clearTimeout(g.timer)
      gesture.current = { mode: 'idle' }
      if (e.type === 'pointercancel') return
      if (g.nodeId) {
        if (s.selectedId === g.nodeId) s.openSheet({ type: 'preview', id: g.nodeId })
        else s.select(g.nodeId)
      } else {
        const now = Date.now()
        const lt = lastTap.current
        if (now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
          fit()
          lastTap.current = { t: 0, x: 0, y: 0 }
        } else lastTap.current = { t: now, x: e.clientX, y: e.clientY }
        s.select(null)
      }
      return
    }

    if (g.mode === 'drag') {
      gesture.current = { mode: 'idle' }
      const d = dragRef.current
      dragRef.current = null
      if (d && e.type !== 'pointercancel' && (Math.abs(d.dx) > 1 || Math.abs(d.dy) > 1)) {
        positions.settle(d.ids, d.dx, d.dy)
        s.moveNode(d.id, d.dx, d.dy)
      }
      setDrag(null)
      return
    }

    if (g.mode === 'pinch') {
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()]
        gesture.current = { mode: 'pan', lx: p.x, ly: p.y, samples: [] }
      } else if (pointers.current.size === 0) {
        gesture.current = { mode: 'idle' }
        commit()
      }
      return
    }

    if (pointers.current.size === 0) {
      gesture.current = { mode: 'idle' }
      if (g.mode === 'pan') {
        // prędkość z ostatnich ~90 ms ruchu → bezwładność
        const a = g.samples[0]
        const b = g.samples[g.samples.length - 1]
        const dt = a && b ? b.t - a.t : 0
        if (dt > 0 && performance.now() - b.t < 60 && e.type !== 'pointercancel') glide((b.x - a.x) / dt, (b.y - a.y) / dt)
        else commit()
      }
    }
  }

  // kółko myszy / gładzik: przewijanie, a z Ctrl (lub gestem szczypania na gładziku) zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const { x, y, k } = vp.current
        const nk = clampK(k * Math.exp(-e.deltaY * 0.01))
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        vp.current = { k: nk, x: px - ((px - x) / k) * nk, y: py - ((py - y) / k) * nk }
        setK(nk)
      } else {
        vp.current.x -= e.deltaX
        vp.current.y -= e.deltaY
      }
      apply()
      clearTimeout(wheelTimer.current)
      wheelTimer.current = window.setTimeout(commit, 250)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [apply, commit])

  // ---------- render ----------
  const positions = useAnimatedPositions(list)
  const byId = useMemo(() => new Map(list.map((v) => [v.node.id, v.node])), [list])
  const pos = (id: string) => {
    const n = byId.get(id)!
    if (drag?.ids.has(id)) return { x: n.x + drag.dx, y: n.y + drag.dy }
    return positions.get(id, n)
  }
  /** animacja wejścia: przy otwarciu mapy węzły rozkwitają od centrum, później nowe „wyskakują” */
  const enterOf = (v: (typeof list)[number]) =>
    v.node.createdAt > mountedAt.current ? ('pop' as const) : ('bloom' as const)

  const menuAction = (fn: () => void) => () => {
    setMenu(null)
    fn()
  }

  return (
    <div
      ref={containerRef}
      className="canvas no-select"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="canvas"
    >
      <div ref={worldRef} className="world">
        <Edges list={list} pos={pos} drawIn={Date.now() - mountedAt.current < 1500} />
        {list.map((v) => {
          const p = pos(v.node.id)
          return (
            <NodeCard
              key={v.node.id}
              v={v}
              x={p.x}
              y={p.y}
              compact={compact}
              selected={v.node.id === selectedId}
              dragging={!!drag?.ids.has(v.node.id)}
              lifted={drag?.id === v.node.id}
              pressed={pressedId === v.node.id}
              enter={enterOf(v)}
            />
          )
        })}
      </div>

      {menu && (
        <div
          className="popover"
          data-ui
          style={{
            left: Math.min(Math.max(12, menu.sx - 105), (containerRef.current?.clientWidth ?? 400) - 232),
            top: menu.sy + 14,
          }}
        >
          <button
            onClick={menuAction(() => {
              primeKeyboard()
              useNous.getState().addRootAt(menu.wx, menu.wy)
            })}
          >
            <IconTarget size={19} stroke={1.75} />
            Nowy punkt centralny tutaj
          </button>
          <button onClick={menuAction(() => fit())}>
            <IconFocusCentered size={19} stroke={1.75} />
            Wyśrodkuj widok
          </button>
          <button onClick={menuAction(() => useNous.getState().tidyMap())}>
            <IconLayoutDistributeVertical size={19} stroke={1.75} />
            Uporządkuj mapę
          </button>
        </div>
      )}

      {!selectedId && (
        <div
          data-ui
          style={{ position: 'absolute', right: 16, bottom: 'var(--above-dock)', zIndex: 22, display: 'flex', gap: 8 }}
        >
          <span className="chip-btn" aria-live="polite">
            {Math.round(k * 100)}%
          </span>
          <button className="chip-btn" onClick={() => fit()} aria-label="Dopasuj widok">
            <IconFocusCentered size={17} stroke={1.75} />
          </button>
        </div>
      )}
    </div>
  )
}
