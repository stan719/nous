import { useEffect } from 'react'

/** Blokuje systemowy zoom strony w Safari (pinch obsługuje kanwa, nie przeglądarka). */
export function installIosGuards() {
  const prevent = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  // zoom dwukrotnym tapnięciem wyłącza `touch-action: manipulation` na body (index.css)
}

/**
 * Ustawia --app-h (wysokość okna aplikacji) i --kb (wysokość klawiatury).
 * Wysokość bierzemy z okna, nie z ekranu — rysowanie poza oknem iOS i tak ucina.
 * Pełny ekran zapewnia pasek statusu w stylu "black" (patrz index.html).
 */
export function useViewportMetrics() {
  useEffect(() => {
    const root = document.documentElement.style
    const vv = window.visualViewport
    const update = () => {
      const appH = window.innerHeight
      root.setProperty('--app-h', `${appH}px`)
      if (!vv) return
      const kbRaw = appH - vv.height - vv.offsetTop
      // arkusz ma stać na klawiaturze (drobne różnice to nie klawiatura)
      const kb = kbRaw > 40 ? kbRaw : 0
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
