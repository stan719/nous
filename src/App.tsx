import { useEffect } from 'react'
import { Dock } from './components/Dock'
import { Toast } from './components/Toast'
import { TopBar } from './components/TopBar'
import { useKeyboardInset } from './lib/ios'
import { usePresence } from './lib/motion'
import { EditSheet } from './sheets/EditSheet'
import { MapsSheet } from './sheets/MapsSheet'
import { PdfSheet } from './sheets/PdfSheet'
import { PreviewSheet } from './sheets/PreviewSheet'
import { SearchSheet } from './sheets/SearchSheet'
import { SheetLeaving } from './sheets/Sheet'
import { useNous } from './store/useNous'
import { CanvasView } from './views/canvas/CanvasView'
import { ListView } from './views/list/ListView'

export function App() {
  const hydrated = useNous((s) => s.hydrated)
  const mapId = useNous((s) => s.currentMapId)
  const view = useNous((s) => s.view)
  const [sheet, leaving] = usePresence(useNous((s) => s.sheet), 260)
  useKeyboardInset()

  // skróty na komputerze: ⌘Z / ⌘⇧Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) useNous.getState().redo()
        else useNous.getState().undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!hydrated || !mapId) return <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)' }} />

  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      <div className="view-enter" key={`${view}-${mapId}`}>
        {view === 'canvas' ? <CanvasView /> : <ListView />}
      </div>
      <TopBar />
      <Dock />
      <SheetLeaving.Provider value={leaving}>
        {sheet?.type === 'preview' && <PreviewSheet key={sheet.id} id={sheet.id} />}
        {sheet?.type === 'edit' && <EditSheet key={sheet.id} id={sheet.id} isNew={sheet.isNew} />}
        {sheet?.type === 'maps' && <MapsSheet />}
        {sheet?.type === 'search' && <SearchSheet />}
        {sheet?.type === 'pdf' && <PdfSheet />}
      </SheetLeaving.Provider>
      <Toast />
    </main>
  )
}
