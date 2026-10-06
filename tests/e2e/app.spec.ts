import { expect, test, type Page } from '@playwright/test'

type Snap = { nodes: Record<string, { id: string; title: string; note: string; parentId: string | null; x: number; y: number; collapsed: boolean; mapId: string; color: string | null }>; currentMapId: string; viewports: Record<string, { k: number }>; maps: Record<string, { showNotes: boolean }> }
const state = (page: Page) => page.evaluate(() => (window as unknown as { nous: { getState: () => Snap } }).nous.getState())
const nodeByTitle = async (page: Page, title: string) => Object.values((await state(page)).nodes).find((n) => n.title === title)!

async function start(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('canvas')).toBeVisible()
  await expect(page.locator('[data-node-id]').first()).toBeVisible()
}

async function tapNode(page: Page, title: string) {
  const n = await nodeByTitle(page, title)
  await page.locator(`[data-node-id="${n.id}"]`).click()
  return n
}

test('pierwsze uruchomienie: mapa powitalna z dwoma punktami centralnymi', async ({ page }) => {
  await start(page)
  await expect(page.getByText('Witaj w Nous')).toBeVisible()
  const s = await state(page)
  expect(Object.values(s.nodes).filter((n) => n.parentId === null)).toHaveLength(2)
  await expect(page.getByText(/9 myśli · 2 centra/)).toBeVisible()
})

test('dodanie dziecka z tytułem i notatką, widoczne na kanwie i liście', async ({ page }) => {
  await start(page)
  await tapNode(page, 'Notatki')
  await page.getByRole('button', { name: 'Dziecko' }).click()
  await page.locator('#f-title').fill('Argumenty za przeprowadzką do Gdańska')
  await page.locator('#f-note').fill('Morze **blisko**\n[ ] sprawdzić czynsze')
  await page.getByRole('button', { name: 'Gotowe' }).click()

  const n = await nodeByTitle(page, 'Argumenty za przeprowadzką do Gdańska')
  expect(n.note).toContain('sprawdzić czynsze')
  expect(n.parentId).toBe((await nodeByTitle(page, 'Notatki')).id)
  await expect(page.locator(`[data-node-id="${n.id}"]`)).toContainText('Morze blisko')

  await page.locator('body').click({ position: { x: 20, y: 400 } })
  await page.getByRole('tab', { name: 'Lista' }).click()
  await expect(page.getByTestId('list').getByText('Argumenty za przeprowadzką do Gdańska')).toBeVisible()
})

test('pusta nowa myśl zamknięta bez treści znika bez śladu', async ({ page }) => {
  await start(page)
  const before = Object.keys((await state(page)).nodes).length
  await tapNode(page, 'Gesty')
  await page.getByRole('button', { name: 'Dziecko' }).click()
  await page.getByRole('button', { name: 'Anuluj' }).click()
  expect(Object.keys((await state(page)).nodes)).toHaveLength(before)
})

test('nowy punkt centralny przyciskiem +', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: 'Nowy punkt centralny' }).click()
  await page.locator('#f-title').fill('Trzecie centrum')
  await page.getByRole('button', { name: 'Gotowe' }).click()
  const n = await nodeByTitle(page, 'Trzecie centrum')
  expect(n.parentId).toBeNull()
  await expect(page.getByText(/3 centra/)).toBeVisible()
})

test('podgląd notatki i odhaczanie zadań bez edycji', async ({ page }) => {
  await start(page)
  await tapNode(page, 'Notatki')
  await tapNode(page, 'Notatki')
  const dialog = page.getByRole('dialog', { name: 'Podgląd myśli' })
  await expect(dialog.getByText('pierwsze zadanie')).toBeVisible()
  await dialog.getByRole('checkbox', { name: 'Oznacz jako zrobione' }).click()
  expect((await nodeByTitle(page, 'Notatki')).note).toContain('[x] pierwsze zadanie')
})

test('przełącznik ¶ zamienia karty z notatką na kompaktowe chipy', async ({ page }) => {
  await start(page)
  await expect(page.locator('.node-card').first()).toBeVisible()
  await page.getByRole('button', { name: 'Ukryj notatki' }).click()
  await expect(page.locator('.node-card')).toHaveCount(0)
  await expect(page.locator('.node-chip').first()).toBeVisible()
})

test('przytrzymanie i przeciągnięcie przesuwa węzeł z poddrzewem', async ({ page }) => {
  await start(page)
  const n = await nodeByTitle(page, 'Notatki')
  const kid = Object.values((await state(page)).nodes).find((x) => x.parentId === n.id)!
  const box = (await page.locator(`[data-node-id="${n.id}"]`).boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.waitForTimeout(500)
  for (let i = 1; i <= 8; i++) await page.mouse.move(cx - i * 5, cy + i * 10)
  await page.mouse.up()
  const after = await nodeByTitle(page, 'Notatki')
  const kidAfter = (await state(page)).nodes[kid.id]
  expect(after.y).toBeGreaterThan(n.y + 50)
  expect(kidAfter.y - kid.y).toBe(after.y - n.y)
})

test('szybki ruch na węźle przesuwa kanwę, a nie węzeł', async ({ page }) => {
  await start(page)
  const n = await nodeByTitle(page, 'Notatki')
  const box = (await page.locator(`[data-node-id="${n.id}"]`).boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + 20 + i * 10, box.y + 20 + i * 10)
  await page.mouse.up()
  expect((await nodeByTitle(page, 'Notatki')).x).toBe(n.x)
})

test('pinch dwoma palcami przybliża wokół punktu między palcami', async ({ page }) => {
  await start(page)
  const res = await page.evaluate(async () => {
    const nous = (window as unknown as { nous: { getState: () => Snap } }).nous
    const vp = () => { const s = nous.getState(); return { ...s.viewports[s.currentMapId] } as { x: number; y: number; k: number } }
    const c = document.querySelector('.canvas')!
    const ev = (type: string, id: number, x: number, y: number) =>
      c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }))
    const v0 = vp()
    ev('pointerdown', 1, 140, 420)
    ev('pointerdown', 2, 240, 420)
    for (let i = 1; i <= 10; i++) {
      ev('pointermove', 1, 140 - i * 5, 420)
      ev('pointermove', 2, 240 + i * 5, 420)
    }
    ev('pointerup', 1, 90, 420)
    ev('pointerup', 2, 290, 420)
    const v1 = vp()
    const anchor = (v: { x: number; y: number; k: number }) => [(190 - v.x) / v.k, (420 - v.y) / v.k]
    return { ratio: v1.k / v0.k, a0: anchor(v0), a1: anchor(v1) }
  })
  expect(res.ratio).toBeCloseTo(2, 1)
  expect(res.a1[0]).toBeCloseTo(res.a0[0], 1)
  expect(res.a1[1]).toBeCloseTo(res.a0[1], 1)
})

test('lista: zwijanie gałęzi', async ({ page }) => {
  await start(page)
  await page.getByRole('tab', { name: 'Lista' }).click()
  const list = page.getByTestId('list')
  await expect(list.getByText('Dwukrotny tap w tło dopasowuje widok')).toBeVisible()
  const gesty = await nodeByTitle(page, 'Gesty')
  await page.locator(`[data-row-id="${gesty.id}"]`).getByRole('button', { name: 'Zwiń' }).click()
  await expect(list.getByText('Dwukrotny tap w tło dopasowuje widok')).toHaveCount(0)
  expect((await nodeByTitle(page, 'Gesty')).collapsed).toBe(true)
})

test('usunięcie i cofnięcie z toasta', async ({ page }) => {
  await start(page)
  await tapNode(page, 'Gesty')
  await page.getByRole('button', { name: 'Więcej' }).click()
  await page.getByRole('button', { name: 'Usuń' }).click()
  await expect(page.getByRole('status')).toContainText('Usunięto')
  expect(Object.values((await state(page)).nodes).some((n) => n.title === 'Gesty')).toBe(false)
  await page.getByRole('status').getByRole('button', { name: 'Cofnij' }).click()
  expect(Object.values((await state(page)).nodes).some((n) => n.title === 'Gesty')).toBe(true)
})

test('dane przetrwają przeładowanie', async ({ page }) => {
  await start(page)
  await tapNode(page, 'Gesty')
  await page.getByRole('button', { name: 'Edytuj' }).click()
  await page.locator('#f-title').fill('Gesty po zmianie')
  await page.getByRole('button', { name: 'Gotowe' }).click()
  await page.waitForTimeout(300)
  await page.reload()
  await expect(page.getByText('Gesty po zmianie')).toBeVisible()
})

test('eksport, import (dodaj) i odrzucenie złego pliku', async ({ page }) => {
  await start(page)
  // w testach bez arkusza udostępniania iOS — sprawdzamy ścieżkę z pobraniem pliku
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }))
  await page.getByRole('button', { name: /Pokaż wszystkie mapy/ }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Eksportuj wszystkie mapy/ }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^nous-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await file.path()

  await page.getByTestId('import-input').setInputFiles(path)
  await expect(page.getByText(/W pliku: 1 mapa, 9 myśli/)).toBeVisible()
  await page.getByRole('button', { name: 'Dodaj do moich' }).click()
  const s = await state(page)
  expect(Object.keys(s.maps)).toHaveLength(2)
  expect(Object.keys(s.nodes)).toHaveLength(18)

  await page.getByRole('button', { name: /Pokaż wszystkie mapy/ }).click()
  await page.getByTestId('import-input').setInputFiles({ name: 'zly.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"inny"}') })
  await expect(page.getByRole('alert')).toContainText('nie wygląda na kopię')
})

test('nowe dziecko ma domyślnie zaznaczony kolor gałęzi', async ({ page }) => {
  await start(page)
  await tapNode(page, 'Notatki')
  await page.getByRole('button', { name: 'Dziecko' }).click()
  await expect(page.getByRole('radio', { name: 'Szałwia' })).toHaveAttribute('aria-checked', 'true')
  await page.locator('#f-title').fill('Dziecko w kolorze gałęzi')
  await page.getByRole('button', { name: 'Gotowe' }).click()
  const n = await nodeByTitle(page, 'Dziecko w kolorze gałęzi')
  expect(n.color).toBe('sage')
})

test('zaznaczony węzeł przeciąga się od razu, bez przytrzymania', async ({ page }) => {
  await start(page)
  const n = await tapNode(page, 'Notatki')
  const box = (await page.locator(`[data-node-id="${n.id}"]`).boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy + i * 12)
  await page.mouse.up()
  expect((await nodeByTitle(page, 'Notatki')).y).toBeGreaterThan(n.y + 40)
})

test('eksport PDF: lista i mapa', async ({ page }) => {
  await start(page)
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }))
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Eksportuj do PDF' }).click()
  const dialog = page.getByRole('dialog', { name: 'Eksport do PDF' })
  await dialog.getByRole('button', { name: 'Utwórz PDF' }).click()
  let download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Zapisz' }).click()
  expect((await download).suggestedFilename()).toBe('pierwsza-mapa-lista.pdf')

  await dialog.getByRole('radio', { name: /Mapa/ }).click()
  await dialog.getByRole('radio', { name: /Ciemny/ }).click()
  await dialog.getByRole('button', { name: 'Utwórz PDF' }).click()
  download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Zapisz' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('pierwsza-mapa-mapa.pdf')
  const { readFileSync } = await import('node:fs')
  expect(readFileSync(await file.path()).subarray(0, 5).toString()).toBe('%PDF-')
})
