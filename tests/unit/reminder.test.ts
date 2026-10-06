import { describe, expect, it } from 'vitest'
import { backupDue, DAY } from '../../src/lib/reminder'

const now = 1_800_000_000_000
const base = { enabled: true, lastExportAt: null, installedAt: now, snoozedUntil: null, nodeCount: 5 }

describe('przypomnienie o kopii co 15 dni', () => {
  it('liczy od instalacji, gdy kopii jeszcze nie było', () => {
    expect(backupDue({ ...base, installedAt: now - 14 * DAY }, now)).toBe(false)
    expect(backupDue({ ...base, installedAt: now - 15 * DAY }, now)).toBe(true)
  })

  it('liczy od ostatniej kopii', () => {
    expect(backupDue({ ...base, installedAt: now - 100 * DAY, lastExportAt: now - 3 * DAY }, now)).toBe(false)
    expect(backupDue({ ...base, installedAt: now - 100 * DAY, lastExportAt: now - 16 * DAY }, now)).toBe(true)
  })

  it('„Jutro” odkłada przypomnienie, wyłączone i pusta aplikacja nie przypominają', () => {
    const old = { ...base, lastExportAt: now - 20 * DAY }
    expect(backupDue({ ...old, snoozedUntil: now + DAY }, now)).toBe(false)
    expect(backupDue({ ...old, snoozedUntil: now - 1 }, now)).toBe(true)
    expect(backupDue({ ...old, enabled: false }, now)).toBe(false)
    expect(backupDue({ ...old, nodeCount: 0 }, now)).toBe(false)
  })
})
