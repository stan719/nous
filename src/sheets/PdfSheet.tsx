import { IconFileTypePdf, IconHierarchy3, IconListTree, IconLoader2, IconMoon, IconShare2, IconSun } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { shareOrDownload } from '../lib/backup'
import { useCurrentMap, useNous } from '../store/useNous'
import { Sheet } from './Sheet'
import type { PdfKind, PdfTheme } from '../lib/pdf'

type State = { status: 'idle' } | { status: 'working' } | { status: 'ready'; file: File } | { status: 'error'; message: string }

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/**
 * Eksport bieżącej mapy do PDF. Dwa kroki (Utwórz → Udostępnij), bo iOS pozwala otworzyć
 * arkusz udostępniania tylko bezpośrednio po dotknięciu, a generowanie chwilę trwa.
 */
export function PdfSheet() {
  const map = useCurrentMap()
  const [kind, setKind] = useState<PdfKind>('list')
  const [theme, setTheme] = useState<PdfTheme>('light')
  const [state, setState] = useState<State>({ status: 'idle' })

  // moduł PDF i czcionki ładujemy dopiero tutaj — nie spowalniają startu aplikacji
  useEffect(() => {
    import('../lib/pdf').then((m) => m.preloadPdfFonts()).catch(() => {})
  }, [])
  useEffect(() => setState({ status: 'idle' }), [kind, theme])

  if (!map) return null

  const create = async () => {
    setState({ status: 'working' })
    try {
      const pdf = await import('../lib/pdf')
      const { nodes } = useNous.getState()
      const bytes = kind === 'map' ? await pdf.buildMapPdf(map, nodes, theme) : await pdf.buildListPdf(map, nodes, theme)
      setState({ status: 'ready', file: new File([bytes as BlobPart], pdf.pdfFileName(map, kind), { type: 'application/pdf' }) })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Nie udało się utworzyć PDF.' })
    }
  }

  const option = (active: boolean) => ({
    borderColor: active ? 'rgb(216 183 122 / 0.55)' : undefined,
    background: active ? 'var(--raised-2)' : undefined,
  })

  return (
    <Sheet onClose={useNous.getState().closeSheet} label="Eksport do PDF">
      <h2 className="serif" style={{ fontSize: 29, lineHeight: 1 }}>
        Eksport do PDF
      </h2>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{map.title}</div>

      <div className="label" style={{ marginTop: 20 }}>
        Zawartość
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }} role="radiogroup" aria-label="Zawartość PDF">
        <button className="tile" style={option(kind === 'list')} onClick={() => setKind('list')} role="radio" aria-checked={kind === 'list'}>
          <IconListTree size={22} stroke={1.75} style={{ color: 'var(--gold)' }} />
          <span className="serif" style={{ fontSize: 21, marginTop: 10 }}>
            Lista
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>konspekt A4 z pełnymi notatkami</span>
        </button>
        <button className="tile" style={option(kind === 'map')} onClick={() => setKind('map')} role="radio" aria-checked={kind === 'map'}>
          <IconHierarchy3 size={22} stroke={1.75} style={{ color: 'var(--gold)' }} />
          <span className="serif" style={{ fontSize: 21, marginTop: 10 }}>
            Mapa
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>kanwa jak na ekranie, jedna strona</span>
        </button>
      </div>

      <div className="label">Wygląd</div>
      <div className="pick" role="radiogroup" aria-label="Wygląd PDF">
        <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} role="radio" aria-checked={theme === 'light'} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, padding: '10px 0' }}>
          <IconSun size={17} stroke={1.75} />
          <span style={{ fontSize: 14 }}>Jasny (do druku)</span>
        </button>
        <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} role="radio" aria-checked={theme === 'dark'} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, padding: '10px 0' }}>
          <IconMoon size={17} stroke={1.75} />
          <span style={{ fontSize: 14 }}>Ciemny</span>
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10, lineHeight: 1.45 }}>
        {kind === 'map'
          ? 'Mapa odwzorowuje kanwę: zwinięte gałęzie zostają zwinięte, notatki zgodnie z przełącznikiem ¶.'
          : 'Lista zawiera wszystkie podpunkty (także zwinięte) z pełną treścią notatek i zadaniami.'}
      </div>

      <div style={{ marginTop: 22 }}>
        {state.status === 'ready' ? (
          <div className="tile" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgb(216 183 122 / 0.45)' }}>
            <IconFileTypePdf size={28} stroke={1.5} style={{ color: 'var(--gold)', flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{kb(state.file.size)} · gotowy</div>
            </div>
            <button className="btn btn-primary" style={{ height: 44 }} onClick={() => shareOrDownload(state.file, map.title)}>
              <IconShare2 size={18} stroke={1.75} />
              Zapisz
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={create} disabled={state.status === 'working'}>
            {state.status === 'working' ? (
              <>
                <IconLoader2 size={18} stroke={1.75} className="spin" />
                Tworzę PDF…
              </>
            ) : (
              <>
                <IconFileTypePdf size={18} stroke={1.75} />
                Utwórz PDF
              </>
            )}
          </button>
        )}
        {state.status === 'error' && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--alert)', marginTop: 10 }}>
            {state.message}
          </div>
        )}
      </div>
    </Sheet>
  )
}
