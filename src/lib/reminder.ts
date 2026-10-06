export const BACKUP_EVERY_DAYS = 15
export const DAY = 86_400_000

export interface ReminderState {
  enabled: boolean
  lastExportAt: number | null
  /** pierwsze uruchomienie — liczymy od niego, gdy kopii jeszcze nie było */
  installedAt: number | null
  snoozedUntil: number | null
  nodeCount: number
}

/** Czy pokazać przypomnienie o kopii (co 15 dni od ostatniej kopii albo od instalacji). */
export function backupDue(s: ReminderState, now = Date.now()): boolean {
  if (!s.enabled || s.nodeCount === 0) return false
  if (s.snoozedUntil && now < s.snoozedUntil) return false
  const since = s.lastExportAt ?? s.installedAt
  if (!since) return false
  return now - since >= BACKUP_EVERY_DAYS * DAY
}

export function daysSince(t: number | null, now = Date.now()) {
  return t ? Math.floor((now - t) / DAY) : null
}
