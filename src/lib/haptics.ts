/**
 * Krótka wibracja potwierdzająca (np. „podniesienie” węzła).
 * Android: Vibration API. iOS 18+: kliknięcie systemowego przełącznika <input switch>
 * wywołuje haptykę Taptic Engine — Safari nie ma do tego osobnego API.
 */
let label: HTMLLabelElement | null = null

export function haptic() {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
    return
  }
  try {
    if (!label) {
      label = document.createElement('label')
      label.setAttribute('aria-hidden', 'true')
      Object.assign(label.style, { position: 'fixed', left: '-100px', top: '0', width: '1px', height: '1px', overflow: 'hidden', opacity: '0', pointerEvents: 'none' })
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      input.tabIndex = -1
      label.appendChild(input)
      document.body.appendChild(label)
    }
    label.click()
  } catch {
    // brak haptyki — nic się nie dzieje
  }
}
