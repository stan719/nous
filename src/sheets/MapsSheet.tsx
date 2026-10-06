import { IconCheck, IconChevronRight, IconDots, IconFileExport, IconFileImport, IconFileTypePdf, IconPlus, IconShieldCheck } from '@tabler/icons-react'
import { useMemo, useRef, useState } from 'react'
import { exportBackup, readBackupFile } from '../lib/backup'
import { BACKUP_EVERY_DAYS } from '../lib/reminder'
import { primeKeyboard } from '../lib/ios'
import { plural } from '../model/numerals'
import { summarize } from '../model/schema'
import { effectiveColor, mapNodes } from '../model/tree'
import type { BackupFile, MindMap, Nodes } from '../model/types'
import { useNous } from '../store/useNous'
import { Sheet } from './Sheet'

const DAY = 86_400_000

function ago(t: number) {
  const d = Math.floor((Date.now() - t) / DAY)
  if (d <= 0) {
    const h = Math.floor((Date.now() - t) / 3_600_000)
    return h <= 0 ? 'teraz' : `${h} godz. temu`
  }
  if (d === 1) return 'wczoraj'
  if (d < 7) return `${d} dni temu`
  return new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

/** Miniatura mapy: rzut wszystkich węzłów na kwadrat 50×50. */
function Thumb({ nodes, mapId }: { nodes: Nodes; mapId: string }) {
  const list = mapNodes(nodes, mapId)
  if (!list.length) return <div className="thumb" />
  const xs = list.map((n) => n.x)
  const ys = list.map((n) => n.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const p = (n: { x: number; y: number }) => ({ x: 9 + ((n.x - minX + (span - (maxX - minX)) / 2) / span) * 32, y: 9 + ((n.y - minY + (span - (maxY - minY)) / 2) / span) * 32 })
  const byId = Object.fromEntries(list.map((n) => [n.id, n]))
  return (
    <svg width="50" height="50" style={{ borderRadius: 15, background: '#0f0f11', border: '1px solid var(--line)', flex: 'none' }} aria-hidden="true">
      {list.map((n) => {
        if (!n.parentId || !byId[n.parentId]) return null
        const a = p(byId[n.parentId])
        const b = p(n)
        const c = effectiveColor(nodes, n.id)
        return <line key={n.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={`var(--c-${c ?? 'none'})`} strokeOpacity={0.6} strokeWidth={1.2} />
      })}
      {list.map((n) => {
        const q = p(n)
        const c = effectiveColor(nodes, n.id)
        return n.parentId ? (
          <circle key={n.id} cx={q.x} cy={q.y} r={2.2} fill={`var(--c-${c ?? 'none'})`} />
        ) : (
          <circle key={n.id} cx={q.x} cy={q.y} r={4.5} fill="var(--ink)" />
        )
      })}
    </svg>
  )
}

function MapCard({ map, current, nodes }: { map: MindMap; current: boolean; nodes: Nodes }) {
  const s = useNous.getState()
  const [mode, setMode] = useState<'idle' | 'menu' | 'rename' | 'delete'>('idle')
  const [name, setName] = useState(map.title)
  const list = mapNodes(nodes, map.id)
  const roots = list.filter((n) => n.parentId === null).length

  if (mode === 'rename') {
    return (
      <form
        className="map-card on"
        onSubmit={(e) => {
          e.preventDefault()
          s.renameMap(map.id, name)
          setMode('idle')
        }}
      >
        <input className="field" style={{ flex: 1, padding: '10px 14px' }} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Nazwa mapy" />
        <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
          Zapisz
        </button>
      </form>
    )
  }

  return (
    <div className={`map-card${current ? ' on' : ''}`} style={{ padding: 0 }}>
      <button style={{ display: 'flex', alignItems: 'center', gap: 13, flex: 1, minWidth: 0, padding: 13, textAlign: 'left' }} onClick={() => s.selectMap(map.id)}>
        <Thumb nodes={nodes} mapId={map.id} />
        <span style={{ minWidth: 0 }}>
          <span className="serif" style={{ fontSize: 21, lineHeight: 1.1, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {map.title}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, display: 'block' }}>
            {list.length} {plural(list.length, ['myśl', 'myśli', 'myśli'])} · {roots} {plural(roots, ['centrum', 'centra', 'centrów'])} · {ago(map.updatedAt)}
          </span>
        </span>
      </button>
      {mode === 'menu' ? (
        <div style={{ display: 'flex', gap: 6, paddingRight: 10 }}>
          <button className="chip-btn" onClick={() => setMode('rename')}>
            Nazwa
          </button>
          <button className="chip-btn" style={{ color: 'var(--alert)' }} onClick={() => setMode('delete')}>
            Usuń
          </button>
        </div>
      ) : mode === 'delete' ? (
        <div style={{ display: 'flex', gap: 6, paddingRight: 10 }}>
          <button className="chip-btn" onClick={() => setMode('idle')}>
            Nie
          </button>
          <button className="chip-btn" style={{ color: '#0b0b0c', background: 'var(--alert)' }} onClick={() => s.deleteMap(map.id)}>
            Usuń mapę
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8 }}>
          {current && <IconCheck size={20} stroke={1.75} style={{ color: 'var(--gold)' }} />}
          <button className="chip-btn" style={{ border: 0, background: 'transparent' }} onClick={() => setMode('menu')} aria-label={`Opcje mapy ${map.title}`}>
            <IconDots size={18} stroke={1.75} />
          </button>
        </div>
      )}
    </div>
  )
}

export function MapsSheet() {
  const maps = useNous((s) => s.maps)
  const nodes = useNous((s) => s.nodes)
  const currentMapId = useNous((s) => s.currentMapId)
  const lastExportAt = useNous((s) => s.lastExportAt)
  const s = useNous.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const sorted = useMemo(() => Object.values(maps).sort((a, b) => b.updatedAt - a.updatedAt), [maps])
  const stale = !lastExportAt || Date.now() - lastExportAt > BACKUP_EVERY_DAYS * DAY
  const reminderOn = useNous((s) => s.backupReminder)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setError(null)
    const res = await readBackupFile(f)
    if (res.ok) setPending(res.data)
    else setError(res.error)
  }

  return (
    <Sheet onClose={s.closeSheet} label="Twoje mapy">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 className="serif" style={{ fontSize: 29, lineHeight: 1 }}>
            Twoje mapy
          </h2>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
            {sorted.length} {plural(sorted.length, ['mapa', 'mapy', 'map'])} na tym urządzeniu
          </div>
        </div>
        <button
          className="icon-btn"
          style={{ background: 'var(--ink)', color: '#0b0b0c', border: 0 }}
          onClick={() => {
            primeKeyboard()
            s.newMap()
          }}
          aria-label="Nowa mapa"
        >
          <IconPlus size={20} stroke={2} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {sorted.map((m) => (
          <MapCard key={m.id} map={m} current={m.id === currentMapId} nodes={nodes} />
        ))}
      </div>

      <div className="label" style={{ marginTop: 22 }}>
        Kopia zapasowa
        <span style={{ marginLeft: 'auto', color: stale ? 'var(--gold)' : 'var(--faint)' }}>
          {lastExportAt ? `ostatnia: ${ago(lastExportAt)}` : 'jeszcze nie zrobiono'}
        </span>
      </div>

      {pending ? (
        <div className="tile" style={{ borderColor: 'rgb(216 183 122 / 0.45)' }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>
            W pliku: {summarize(pending).maps} {plural(summarize(pending).maps, ['mapa', 'mapy', 'map'])}, {summarize(pending).nodes}{' '}
            {plural(summarize(pending).nodes, ['myśl', 'myśli', 'myśli'])}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
            Kopia z {new Date(pending.exportedAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ height: 44, flex: 1 }} onClick={() => s.importBackup(pending, 'add')}>
              Dodaj do moich
            </button>
            {confirmReplace ? (
              <button className="btn btn-danger" style={{ height: 44, flex: 1 }} onClick={() => s.importBackup(pending, 'replace')}>
                Na pewno zastąpić?
              </button>
            ) : (
              <button className="btn btn-ghost" style={{ height: 44, flex: 1 }} onClick={() => setConfirmReplace(true)}>
                Zastąp wszystko
              </button>
            )}
            <button className="btn" style={{ height: 44, color: 'var(--muted)' }} onClick={() => setPending(null)}>
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <button className="tile" onClick={() => exportBackup().catch(() => setError('Nie udało się wyeksportować.'))}>
            <IconFileExport size={22} stroke={1.75} style={{ color: 'var(--gold)' }} />
            <span className="serif" style={{ display: 'block', fontSize: 21, marginTop: 10 }}>
              Eksportuj
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>wszystkie mapy do .json</span>
          </button>
          <button className="tile" onClick={() => fileRef.current?.click()}>
            <IconFileImport size={22} stroke={1.75} style={{ color: 'var(--gold)' }} />
            <span className="serif" style={{ display: 'block', fontSize: 21, marginTop: 10 }}>
              Importuj
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>z pliku .json</span>
          </button>
        </div>
      )}
      <button
        className="toggle-row"
        style={{ marginTop: 9 }}
        onClick={() => s.setBackupReminder(!reminderOn)}
        role="switch"
        aria-checked={reminderOn}
      >
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 14.5, display: 'block' }}>Przypominaj co {BACKUP_EVERY_DAYS} dni</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Karta z eksportem pojawi się przy otwarciu aplikacji</span>
        </span>
        <span className={`switch${reminderOn ? ' on' : ''}`} />
      </button>
      <button className="map-card" style={{ marginTop: 9, padding: '12px 14px' }} onClick={() => s.openSheet({ type: 'pdf' })}>
        <IconFileTypePdf size={22} stroke={1.75} style={{ color: 'var(--gold)' }} />
        <span style={{ flex: 1, fontSize: 14.5 }}>Eksportuj bieżącą mapę do PDF</span>
        <IconChevronRight size={18} stroke={1.75} style={{ color: 'var(--muted)' }} />
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} data-testid="import-input" />
      {error && (
        <div role="alert" style={{ fontSize: 13, color: 'var(--alert)', marginTop: 10 }}>
          {error}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <IconShieldCheck size={15} stroke={1.75} style={{ color: 'var(--c-sage)' }} />
        Dane zostają tylko na tym urządzeniu. Bez kont, bez chmury.
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
        Nous · wersja {__APP_BUILD__} · okno {window.innerWidth}×{window.innerHeight} · ekran {screen.width}×{screen.height}
      </div>
    </Sheet>
  )
}
