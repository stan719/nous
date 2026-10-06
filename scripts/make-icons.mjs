// Generuje ikony PWA z jednego SVG: ciemne tło, jasny punkt centralny, trzy kolorowe gałęzie.
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const svg = (pad = 0) => {
  const s = 512, c = s / 2, k = (s - pad * 2) / s
  const p = (x, y) => [c + (x - c) * k, c + (y - c) * k]
  const branch = (x, y, color) => {
    const [px, py] = p(x, y), [cx, cy] = p(c, c)
    return `<path d="M${cx},${cy} Q${(cx + px) / 2},${cy} ${px},${py}" stroke="${color}" stroke-width="${14 * k}" stroke-linecap="round" fill="none" opacity=".75"/>
<circle cx="${px}" cy="${py}" r="${30 * k}" fill="${color}"/>`
  }
  const [cx, cy] = p(c, c)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<rect width="${s}" height="${s}" fill="#0a0a0b"/>
<circle cx="${cx}" cy="${cy}" r="${200 * k}" fill="#d8b77a" opacity=".07"/>
${branch(118, 140, '#7fb5e8')}${branch(398, 160, '#8cc39b')}${branch(372, 392, '#e9bb69')}${branch(132, 372, '#ab9cf5')}
<circle cx="${cx}" cy="${cy}" r="${74 * k}" fill="#f3f0ea"/>
<circle cx="${cx}" cy="${cy}" r="${98 * k}" fill="none" stroke="#f3f0ea" stroke-opacity=".12" stroke-width="${12 * k}"/>
</svg>`
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/favicon.svg', svg(0))
await sharp(Buffer.from(svg(0))).resize(180).png().toFile('public/icons/apple-touch-icon.png')
await sharp(Buffer.from(svg(0))).resize(192).png().toFile('public/icons/icon-192.png')
await sharp(Buffer.from(svg(0))).resize(512).png().toFile('public/icons/icon-512.png')
await sharp(Buffer.from(svg(60))).resize(512).png().toFile('public/icons/icon-maskable-512.png')
console.log('ikony gotowe')
