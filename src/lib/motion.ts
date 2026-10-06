import { useEffect, useRef, useState } from 'react'

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** Sprężyna bez przestrzelenia (krytycznie tłumiona) — do ruchu widoku i węzłów. */
export const springOut = (t: number) => (t >= 1 ? 1 : 1 - Math.exp(-7 * t) * (1 + 7 * t))
/** Lekko „żywa” sprężyna z małym przestrzeleniem — do pojawiania się elementów. */
export const springPop = (t: number) => {
  if (t >= 1) return 1
  const z = 0.62
  const w = 14
  const wd = w * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t))
}

interface TweenOpts {
  duration: number
  ease?: (t: number) => number
  onUpdate: (p: number) => void
  onDone?: () => void
}

/**
 * Animacja oparta na requestAnimationFrame. Gdy rAF jest wstrzymany (karta w tle),
 * zabezpieczający timeout i tak doprowadzi wartość do końca. Zwraca funkcję anulującą.
 */
export function tween({ duration, ease = springOut, onUpdate, onDone }: TweenOpts): () => void {
  if (duration <= 0 || reducedMotion()) {
    onUpdate(1)
    onDone?.()
    return () => {}
  }
  let raf = 0
  let finished = false
  const start = performance.now()
  const finish = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
    clearTimeout(safety)
    onUpdate(1)
    onDone?.()
  }
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    onUpdate(ease(t))
    if (t < 1) raf = requestAnimationFrame(frame)
    else finish()
  }
  raf = requestAnimationFrame(frame)
  const safety = window.setTimeout(finish, duration + 120)
  return () => {
    finished = true
    cancelAnimationFrame(raf)
    clearTimeout(safety)
  }
}

/**
 * Obecność z animacją wyjścia: zwraca ostatnią niepustą wartość jeszcze przez `ms`
 * po jej zniknięciu oraz flagę `leaving`, żeby komponent mógł zagrać animację zamknięcia.
 */
export function usePresence<T>(value: T | null, ms: number): [T | null, boolean] {
  const [shown, setShown] = useState(value)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef(0)
  useEffect(() => {
    clearTimeout(timer.current)
    if (value) {
      setShown(value)
      setLeaving(false)
    } else if (shown) {
      setLeaving(true)
      timer.current = window.setTimeout(() => {
        setShown(null)
        setLeaving(false)
      }, reducedMotion() ? 0 : ms)
    }
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return [value ?? shown, leaving && !value]
}
