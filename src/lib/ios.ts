import { useEffect } from 'react'

/** Blokuje systemowy zoom strony w Safari (pinch obsługuje kanwa, nie przeglądarka). */
export function installIosGuards() {
  const prevent = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  // zoom dwukrotnym tapnięciem wyłącza `touch-action: manipulation` na body (index.css)
}

/**
 * Ustawia --app-h (pełna wysokość ekranu) i --kb (wysokość klawiatury).
 * W trybie aplikacji z ekranu początkowego iOS potrafi zgłosić wysokość okna mniejszą
 * niż ekran — wtedy na dole zostaje pusty pas przy zaokrągleniu. Bierzemy więc
 * większą z wartości: okno albo fizyczny ekran.
 */
export function useViewportMetrics() {
  useEffect(() => {
    const root = document.documentElement.style
    const vv = window.visualViewport
    const update = () => {
      const portrait = window.innerHeight >= window.innerWidth
      const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
      const appH = isStandalone() ? Math.max(window.innerHeight, screenH) : window.innerHeight
      root.setProperty('--app-h', `${appH}px`)
      if (!vv) return
      const kbRaw = window.innerHeight - vv.height - vv.offsetTop
      // arkusz ma stać na klawiaturze; liczymy od dołu kontenera aplikacji
      const kb = kbRaw > 40 ? Math.max(0, appH - vv.height - vv.offsetTop) : 0
      root.setProperty('--kb', `${Math.round(kb)}px`)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
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
