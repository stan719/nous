import { useEffect } from 'react'

/** Blokuje systemowy zoom strony w Safari (pinch obsługuje kanwa, nie przeglądarka). */
export function installIosGuards() {
  const prevent = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  // zoom dwukrotnym tapnięciem wyłącza `touch-action: manipulation` na body (index.css)
}

/** Ustawia zmienną CSS --kb na wysokość klawiatury ekranowej (dla arkuszy). */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}

/**
 * iOS pokazuje klawiaturę tylko, gdy focus nastąpi synchronicznie w obsłudze dotyku.
 * Wywołaj w handlerze tapnięcia przed otwarciem arkusza — pole w arkuszu przejmie
 * focus chwilę później i klawiatura zostanie.
 */
export function primeKeyboard() {
  let el = document.getElementById('kb-primer') as HTMLInputElement | null
  if (!el) {
    el = document.createElement('input')
    el.id = 'kb-primer'
    el.setAttribute('aria-hidden', 'true')
    el.tabIndex = -1
    Object.assign(el.style, { position: 'fixed', top: '0', left: '0', opacity: '0', height: '0', width: '0', fontSize: '16px', pointerEvents: 'none' })
    document.body.appendChild(el)
  }
  el.focus({ preventScroll: true })
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
