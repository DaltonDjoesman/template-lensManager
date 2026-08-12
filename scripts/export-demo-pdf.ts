/**
 * Export a demo proforma PDF from seed data for README / GIF frames.
 * Run: npx tsx scripts/export-demo-pdf.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k)! : null),
  setItem: (k, v) => {
    store.set(k, String(v))
  },
  removeItem: (k) => {
    store.delete(k)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID },
})

const { applySeedDataset } = await import('../src/lib/demoData.ts')
const { getOrder } = await import('../src/lib/orders.ts')
const { buildOrderPdfDefinition } = await import('../src/lib/orderPdf.ts')

await applySeedDataset()
const order = await getOrder('seed-order-confirmed')
if (!order) throw new Error('seed-order-confirmed missing')

const pdfMakeMod = await import('pdfmake/build/pdfmake.js')
const fontsMod = await import('pdfmake/build/vfs_fonts.js')
const pdfMake = ((pdfMakeMod as { default?: unknown }).default ??
  pdfMakeMod) as {
  addVirtualFileSystem?: (vfs: unknown) => void
  createPdf: (doc: unknown) => {
    getBase64: (cb?: (b64: string) => void) => Promise<string> | void
  }
}
const fonts = (fontsMod as { default?: unknown }).default ?? fontsMod
const vfs =
  (fonts as { pdfMake?: { vfs?: unknown } }).pdfMake?.vfs ?? fonts

if (typeof pdfMake.addVirtualFileSystem === 'function') {
  pdfMake.addVirtualFileSystem(vfs)
}

const definition = buildOrderPdfDefinition(order, 'proforma')
const b64 = await new Promise<string>((resolve, reject) => {
  try {
    const result = pdfMake.createPdf(definition).getBase64((data) => {
      resolve(data)
    })
    if (result && typeof (result as Promise<string>).then === 'function') {
      void (result as Promise<string>).then(resolve, reject)
    }
  } catch (err) {
    reject(err)
  }
})

const buffer = Buffer.from(b64, 'base64')
const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs',
  'screenshots',
)
mkdirSync(outDir, { recursive: true })
const outPdf = join(outDir, 'demo-proforma.pdf')
writeFileSync(outPdf, buffer)
console.log('Wrote', outPdf, `(${buffer.length} bytes)`)
