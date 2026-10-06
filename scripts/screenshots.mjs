// Zrzuty ekranu działającej aplikacji (WebKit, iPhone 15) → design/screens/*.png + zestawienie.
// Wymaga uruchomionego serwera: npx vite --port 5174
import { devices, webkit } from '@playwright/test'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL ?? 'http://localhost:5174'
const out = 'design/screens'
mkdirSync(out, { recursive: true })

const browser = await webkit.launch()
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const st = () => page.evaluate(() => window.nous.getState())
const idOf = async (title) => Object.values((await st()).nodes).find((n) => n.title === title).id
const shot = async (name) => {
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${out}/${name}.png` })
}

await page.goto(URL)
await page.waitForSelector('[data-node-id]')
await shot('1-kanwa')

await page.locator(`[data-node-id="${await idOf('Notatki')}"]`).click()
await shot('2-zaznaczenie')

await page.locator(`[data-node-id="${await idOf('Notatki')}"]`).click()
await shot('3-podglad')

await page.getByRole('dialog').getByRole('button', { name: 'Edytuj' }).click()
await shot('4-edycja')
await page.getByRole('button', { name: 'Anuluj' }).click()
await page.evaluate(() => window.nous.getState().select(null))

await page.getByRole('tab', { name: 'Lista' }).click()
await shot('5-lista')

await page.getByRole('tab', { name: 'Kanwa' }).click()
await page.evaluate(() => {
  const s = window.nous.getState()
  s.setViewport(s.currentMapId, { x: 130, y: 210, k: 0.42 })
})
await page.reload()
await page.waitForSelector('[data-node-id]')
// przytrzymanie pustego miejsca → menu nowego punktu centralnego
await page.evaluate(async () => {
  const c = document.querySelector('.canvas')
  c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: 300, clientY: 300 }))
  await new Promise((r) => setTimeout(r, 500))
  c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: 300, clientY: 300 }))
})
await shot('6-wiele-centrow')

await page.evaluate(() => window.nous.getState().openSheet({ type: 'maps' }))
await shot('7-mapy')
await browser.close()

// zestawienie w jednym obrazie
const names = ['1-kanwa', '2-zaznaczenie', '3-podglad', '4-edycja', '5-lista', '6-wiele-centrow', '7-mapy']
const w = 393, h = 852, gap = 28, pad = 40, scale = 1
const tiles = await Promise.all(
  names.map(async (n) => ({
    input: await sharp(`${out}/${n}.png`).resize(w * scale, h * scale).composite([{
      input: Buffer.from(`<svg width="${w}" height="${h}"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="44" fill="none" stroke="#34343a" stroke-width="1"/></svg>`), top: 0, left: 0,
    }]).png().toBuffer(),
  })),
)
const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="44" fill="#fff"/></svg>`)
const rounded = await Promise.all(tiles.map((t) => sharp(t.input).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()))
const cols = 4
const rows = Math.ceil(names.length / cols)
await sharp({ create: { width: pad * 2 + cols * w + (cols - 1) * gap, height: pad * 2 + rows * h + (rows - 1) * gap, channels: 4, background: '#050506' } })
  .composite(rounded.map((input, i) => ({ input, left: pad + (i % cols) * (w + gap), top: pad + Math.floor(i / cols) * (h + gap) })))
  .png()
  .toFile(`${out}/zestawienie.png`)
console.log('zrzuty gotowe w', out)
