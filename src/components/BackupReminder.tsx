import { IconArchive, IconFileExport } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { exportBackup } from '../lib/backup'
import { usePresence } from '../lib/motion'
import { BACKUP_EVERY_DAYS, backupDue, daysSince } from '../lib/reminder'
import { useNous } from '../store/useNous'

/**
 * Przypomnienie o kopii zapasowej co 15 dni. Bez serwera aplikacja nie może wysłać
 * powiadomienia systemowego, więc karta pojawia się przy otwarciu (lub powrocie) aplikacji.
 */
export function BackupReminder() {
  const due = useNous((s) =>
    backupDue({
      enabled: s.backupReminder,
      lastExportAt: s.lastExportAt,
      installedAt: s.installedAt,
      snoozedUntil: s.backupSnoozedUntil,
      nodeCount: Object.keys(s.nodes).length,
    }),
  )
  const lastExportAt = useNous((s) => s.lastExportAt)
  const sheetOpen = useNous((s) => !!s.sheet)
  const [ready, setReady] = useState(false)
  const [, recheck] = useState(0)

  // pokaż chwilę po starcie (najpierw mapa) i sprawdź ponownie po powrocie do aplikacji
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200)
    const onVisible = () => document.visibilityState === 'visible' && recheck((n) => n + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const visible = ready && due && !sheetOpen
  const [shown, leaving] = usePresence(visible ? true : null, 240)
  if (!shown) return null

  const days = daysSince(lastExportAt)
  const s = useNous.getState()
  const exportNow = async () => {
    const res = await exportBackup()
    if (res !== 'cancelled') s.showToast(`Kopia zapisana · następne przypomnienie za ${BACKUP_EVERY_DAYS} dni`)
  }

  return (
    <div className={`reminder${leaving ? ' leaving' : ''}`} role="dialog" aria-label="Przypomnienie o kopii zapasowej" data-ui>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="reminder-icon" aria-hidden="true">
          <IconArchive size={20} stroke={1.75} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 21, lineHeight: 1.1 }}>
            Czas na kopię zapasową
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5, lineHeight: 1.45 }}>
            {days === null ? 'Nie masz jeszcze kopii swoich map.' : `Ostatnia kopia ${days} dni temu.`} Zapisz plik w Plikach — przywrócisz z
            niego mapy, gdyby coś stało się z telefonem.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={exportNow}>
          <IconFileExport size={18} stroke={1.75} />
          Eksportuj teraz
        </button>
        <button className="btn btn-ghost" style={{ height: 46 }} onClick={() => s.snoozeBackup(1)}>
          Jutro
        </button>
      </div>
    </div>
  )
}
