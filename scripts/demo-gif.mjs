// Nagrywa krótkie demo ruchu (WebKit, iPhone) jako animowany GIF: design/screens/demo-ruch.gif
// Wymaga uruchomionego serwera: npx vite --port 5174
import { devices, webkit } from '@playwright/test'
import sharp from 'sharp'

const URL = process.env.URL ?? 'http://localhost:5174'
const browser = await webkit.launch()
const ctx = await browser.newContext({ ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const frames = []
let recording = true
const record = (async () => {
  while (recording) {
    const t = Date.now()
    frames.push({ buf: await page.screenshot({ type: 'png' }).catch(() => null), t })
  }
})()
const wait = (ms) => page.waitForTimeout(ms)
const idOf = async (title) => page.evaluate((t) => Object.values(window.nous.getState().nodes).find((n) => n.title === t).id, title)

await page.goto(URL)
await page.waitForSelector('[data-node-id]')
await wait(1400)
await page.locator(`[data-node-id="${await idOf('Notatki')}"]`).click()
await wait(700)
await page.getByRole('button', { name: 'Dziecko' }).click()
await wait(600)
await page.locator('#f-title').type('Nowa myśl w kolorze gałęzi', { delay: 25 })
await page.getByRole('button', { name: 'Gotowe' }).click()
await wait(1100)
await page.locator('.canvas').click({ position: { x: 40, y: 640 } })
await wait(400)
await page.getByRole('button', { name: 'Menu' }).click()
await wait(350)
await page.getByRole('button', { name: 'Uporządkuj mapę' }).click()
await wait(1100)
await page.getByRole('tab', { name: 'Lista' }).click()
await wait(1200)
recording = false
await record
await browser.close()

// klatki → GIF ze zmiennym czasem trwania (rzeczywiste odstępy między zrzutami)
const ok = frames.filter((f) => f.buf)
const delays = ok.map((f, i) => Math.max(40, Math.min(400, (ok[i + 1]?.t ?? f.t + 100) - f.t)))
const scaled = await Promise.all(ok.map((f) => sharp(f.buf).resize(300).png().toBuffer()))
await sharp(scaled, { join: { animated: true } })
  .gif({ delay: delays, loop: 0, effort: 7, colours: 128 })
  .toFile('design/screens/demo-ruch.gif')
console.log(`demo: ${ok.length} klatek`)
