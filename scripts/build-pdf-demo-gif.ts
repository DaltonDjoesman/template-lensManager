/**
 * Capture full-viewport PDF demo frames with cursor overlay and build GIF.
 * Requires: npx playwright (chromium), ImageMagick (convert).
 * Run: npx tsx scripts/build-pdf-demo-gif.ts [baseUrl]
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'screenshots')
const FRAMES = join(OUT, 'gif-frames')
const BASE = process.argv[2] ?? 'http://localhost:5173'
/** Desktop-like 16:9 viewport (avoid narrow 1024px captures). */
const VIEWPORT = { width: 1440, height: 900 }

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}

function makeCursorSvg(pressed: boolean): string {
  const y = pressed ? 2 : 0
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <path d="M2 2 L2 28 L9 21 L14 34 L18 32 L13 19 L22 19 Z"
        fill="#111827" stroke="#ffffff" stroke-width="1.5"
        transform="translate(0 ${y})"/>
</svg>`
}

async function main() {
  mkdirSync(FRAMES, { recursive: true })
  const cursorPath = join(FRAMES, 'cursor.png')
  const cursorDownPath = join(FRAMES, 'cursor-down.png')
  writeFileSync(join(FRAMES, 'cursor.svg'), makeCursorSvg(false))
  writeFileSync(join(FRAMES, 'cursor-down.svg'), makeCursorSvg(true))
  run(`convert -background none "${join(FRAMES, 'cursor.svg')}" "${cursorPath}"`)
  run(`convert -background none "${join(FRAMES, 'cursor-down.svg')}" "${cursorDownPath}"`)

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  await page.goto(`${BASE}/pedidos`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=PED2608-0001', { timeout: 15000 })

  type FrameSpec = {
    name: string
    url?: string
    beforeShot?: () => Promise<void>
    cursor?: { selector: string; pressed?: boolean; hoverFirst?: boolean }
  }

  const specs: FrameSpec[] = [
    { name: '01-orders', url: `${BASE}/pedidos` },
    {
      name: '02-open-hover',
      url: `${BASE}/pedidos`,
      cursor: {
        selector: 'a[href="/pedidos/seed-order-confirmed"]',
        hoverFirst: true,
      },
    },
    {
      name: '03-open-click',
      url: `${BASE}/pedidos`,
      cursor: {
        selector: 'a[href="/pedidos/seed-order-confirmed"]',
        pressed: true,
      },
    },
    {
      name: '04-order',
      url: `${BASE}/pedidos/seed-order-confirmed`,
      beforeShot: async () => {
        await page.waitForTimeout(400)
      },
    },
    {
      name: '05-proforma-hover',
      url: `${BASE}/pedidos/seed-order-confirmed`,
      beforeShot: async () => {
        await page.evaluate(() => {
          const block = document.querySelector('.order-docs-block')
          block?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(250)
      },
      cursor: {
        selector: 'button:has-text("Generate Proforma")',
        hoverFirst: true,
      },
    },
    {
      name: '06-proforma-click',
      url: `${BASE}/pedidos/seed-order-confirmed`,
      beforeShot: async () => {
        await page.evaluate(() => {
          const block = document.querySelector('.order-docs-block')
          block?.scrollIntoView({ block: 'center' })
        })
        await page.waitForTimeout(200)
      },
      cursor: {
        selector: 'button:has-text("Generate Proforma")',
        pressed: true,
      },
    },
    {
      name: '07-toast',
      url: `${BASE}/pedidos/seed-order-confirmed`,
      beforeShot: async () => {
        await page.evaluate(() => {
          const block = document.querySelector('.order-docs-block')
          block?.scrollIntoView({ block: 'center' })
        })
        page.once('download', () => {})
        await page.click('button:has-text("Generate Proforma")')
        await page.waitForSelector('.toast', { timeout: 10000 })
        await page.waitForTimeout(500)
      },
    },
    {
      name: '08-pdf',
      beforeShot: async () => {
        execSync('npx tsx scripts/export-demo-pdf.ts', { cwd: ROOT, stdio: 'pipe' })
        const preview = join(OUT, 'pdf-preview.html')
        if (!existsSync(preview)) {
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>PF2608-0001.pdf</title>
<style>html,body{margin:0;height:100%;background:#525659;font-family:system-ui,sans-serif}
.bar{height:44px;background:#323639;color:#fff;display:flex;align-items:center;padding:0 16px;gap:10px;font-size:13px}
.dot{width:10px;height:10px;border-radius:50%;background:#f45}.dot:nth-child(2){background:#fc1}.dot:nth-child(3){background:#2d4}
.stage{display:flex;justify-content:center;padding:20px;box-sizing:border-box;min-height:calc(100% - 44px)}
img{width:min(900px,94vw);background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.45)}</style></head>
<body><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
<span>PF_PF2608-0001.pdf</span></div><div class="stage"><img src="proforma-pdf.png" alt="Proforma"></div></body></html>`
          writeFileSync(preview, html)
        }
        await page.goto(`file://${preview}`, { waitUntil: 'networkidle' })
      },
    },
  ]

  const framePaths: string[] = []

  for (const spec of specs) {
    if (spec.url && spec.name !== '08-pdf') {
      await page.goto(spec.url, { waitUntil: 'networkidle' })
    }
    if (spec.beforeShot) await spec.beforeShot()

    const rawPath = join(FRAMES, `${spec.name}-raw.png`)
    await page.screenshot({ path: rawPath, fullPage: false })

    let outPath = join(FRAMES, `${spec.name}.png`)
    if (spec.cursor) {
      const el = page.locator(spec.cursor.selector).first()
      await el.waitFor({ state: 'visible', timeout: 5000 })
      if (spec.cursor.hoverFirst) await el.hover()
      const box = await el.boundingBox()
      if (!box) throw new Error(`No box for ${spec.cursor.selector}`)
      const cursor = spec.cursor.pressed ? cursorDownPath : cursorPath
      const x = Math.round(box.x + box.width / 2 - 4)
      const y = Math.round(box.y + box.height / 2 - 4)
      run(
        `convert "${rawPath}" "${cursor}" -geometry +${x}+${y} -composite "${outPath}"`,
      )
    } else {
      run(`cp "${rawPath}" "${outPath}"`)
    }
    framePaths.push(outPath)
  }

  await browser.close()

  // Normalize height (settings-like 709 max) and build GIF
  const TARGET = '1440x900'
  const normDir = join(FRAMES, 'norm')
  mkdirSync(normDir, { recursive: true })
  const normPaths: string[] = []
  framePaths.forEach((p, i) => {
    const n = join(normDir, `${String(i + 1).padStart(2, '0')}.png`)
    run(
      `convert "${p}" -resize "${TARGET}>" -background '#f1f5f9' -gravity north -extent ${TARGET} "${n}"`,
    )
    normPaths.push(n)
  })

  const gifOut = join(OUT, 'proforma-pdf-demo.gif')
  const delays = [130, 90, 70, 120, 100, 70, 130, 200]
  const inputs = normPaths
    .map((p, i) => `-delay ${delays[i] ?? 120} "${p}"`)
    .join(' ')
  run(`convert -loop 0 ${inputs} -layers Optimize "${gifOut}"`)

  // Refresh still from export
  run('npx tsx scripts/export-demo-pdf.ts')
  const pdfPng = join(OUT, 'demo-proforma-1.png')
  if (existsSync(pdfPng)) {
    run(`cp "${pdfPng}" "${join(OUT, 'proforma-pdf.png')}"`)
  }

  console.log('GIF written:', gifOut)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
