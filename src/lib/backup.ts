import { makeBackup, parseBackup, type ParseResult } from '../model/schema'
import { useNous } from '../store/useNous'

const fileName = () => `nous-${new Date().toISOString().slice(0, 10)}.json`

/**
 * Eksport wszystkich map. Na iPhonie otwiera arkusz udostępniania („Zachowaj w Plikach”),
 * w innych przeglądarkach pobiera plik.
 */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { maps, nodes, viewports, markExported } = useNous.getState()
  const json = JSON.stringify(makeBackup(maps, nodes, viewports), null, 2)
  const file = new File([json], fileName(), { type: 'application/json' })
  const res = await shareOrDownload(file, 'Kopia Nous')
  if (res !== 'cancelled') markExported()
  return res
}

/**
 * iPhone: arkusz udostępniania (Zachowaj w Plikach, AirDrop, Drukuj…).
 * Gdzie indziej: zwykłe pobranie pliku.
 */
export async function shareOrDownload(file: File, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
      // inne błędy → spróbuj zwykłego pobrania
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}

export async function readBackupFile(file: File): Promise<ParseResult> {
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: 'Plik jest za duży (ponad 50 MB).' }
  return parseBackup(await file.text())
}
