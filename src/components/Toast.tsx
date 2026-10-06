import { useEffect } from 'react'
import { usePresence } from '../lib/motion'
import { useNous } from '../store/useNous'

export function Toast() {
  const current = useNous((s) => s.toast)
  const [toast, leaving] = usePresence(current, 220)
  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => useNous.getState().hideToast(), current.undo ? 5000 : 2500)
    return () => clearTimeout(t)
  }, [current])
  if (!toast) return null
  return (
    <div className={`toast${leaving ? ' leaving' : ''}`} role="status" key={toast.id}>
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          onClick={() => {
            useNous.getState().undo()
            useNous.getState().hideToast()
          }}
        >
          Cofnij
        </button>
      )}
    </div>
  )
}
