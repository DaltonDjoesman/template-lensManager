/**
 * Node smoke tests for domain libs against LocalStorageAdapter.
 * Run: npx tsx scripts/smoke-domain.ts
 */
import { LocalStorageAdapter } from '../src/lib/storage/localStorageAdapter'
import { STORAGE_COLLECTIONS, STORAGE_SINGLETONS } from '../src/lib/storage/types'

// Minimal localStorage polyfill
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
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

if (!globalThis.crypto?.randomUUID) {
  ;(globalThis as { crypto: Crypto }).crypto = {
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }),
  } as Crypto
}

const adapter = new LocalStorageAdapter()

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function main() {
  console.log('=== 5.1 Clients + delivery locations ===')
  const clientId = await adapter.createDoc(STORAGE_COLLECTIONS.clients, {
    billing: {
      name: 'Optica Demo',
      nif: 'PT123',
      contactName: 'Ana',
      phone: '123',
      email: 'a@demo.test',
      address: 'Street 1',
    },
    deliveryLocations: [
      {
        id: crypto.randomUUID(),
        label: 'Primary delivery',
        recipient: 'Shop',
        careOf: '',
        phone: '123',
        address: 'Street 1',
        postalCode: '1000',
        isPrimary: true,
      },
    ],
    defaultDiscount: { percent: 5 },
    paymentTerms: 'net_30',
  })
  const client = await adapter.getDoc(STORAGE_COLLECTIONS.clients, clientId)
  assert(client?.billing && (client.billing as { name: string }).name === 'Optica Demo', 'client create')
  await adapter.setDoc(STORAGE_COLLECTIONS.clients, clientId, {
    ...client!,
    billing: { ...(client!.billing as object), name: 'Optica Updated' },
  })
  const updated = await adapter.getDoc(STORAGE_COLLECTIONS.clients, clientId)
  assert(
    (updated!.billing as { name: string }).name === 'Optica Updated',
    'client update',
  )
  console.log('OK clients CRUD')

  console.log('=== 5.1b Unique NIF + payment terms ===')
  const { createClient, DuplicateNifError } = await import('../src/lib/clients')
  try {
    await createClient({
      billing: {
        name: 'Duplicate Optic',
        nif: 'PT123',
        contactName: 'Ana',
        phone: '123',
        email: 'b@demo.test',
        address: 'Street 2',
      },
      deliveryLocations: [],
      defaultDiscount: {},
      paymentTerms: 'a_pronto',
    })
    assert(false, 'duplicate NIF should throw')
  } catch (err) {
    assert(err instanceof DuplicateNifError, 'DuplicateNifError on create')
  }
  console.log('OK unique NIF')

  console.log('=== 5.2 Catalog CRUD ===')
  const productId = await adapter.createDoc(STORAGE_COLLECTIONS.products, {
    sku: 'MID Clear 1.50',
    description: 'Mid-index clear stock lens (demo)',
    unitPrice: 9.45,
    sphMin: -4,
    sphMax: 4,
    cylMin: -3,
    cylMax: 0,
  })
  const product = await adapter.getDoc(STORAGE_COLLECTIONS.products, productId)
  assert((product!.sku as string) === 'MID Clear 1.50', 'product create')
  await adapter.setDoc(STORAGE_COLLECTIONS.products, productId, {
    ...product!,
    unitPrice: 11.2,
  })
  const product2 = await adapter.getDoc(STORAGE_COLLECTIONS.products, productId)
  assert((product2!.unitPrice as number) === 11.2, 'product update')
  console.log('OK catalog CRUD')

  console.log('=== 5.3 Orders draft/confirm/discount/duplicate/delete ===')
  const { computeOrderTotals } = await import('../src/types/order')
  const lines = [
    {
      id: crypto.randomUUID(),
      productId,
      familySku: 'MID Clear 1.50',
      description: 'Mid-index clear stock lens (demo)',
      sph: -1,
      cyl: -0.5,
      qty: 2,
      unitPrice: 11.2,
      lineSku: 'MID Clear 1.50_-1.00_-0.50',
    },
  ]
  const totals = computeOrderTotals(lines, { percent: 10 })
  assert(totals.subtotalNet > 0, 'net total')
  assert(Math.abs(totals.subtotalNet - 11.2 * 2 * 0.9) < 0.01, 'discount 10%')
  const eur = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(totals.subtotalNet)
  assert(eur.includes('€') || /EUR|€/.test(eur), `EUR format: ${eur}`)

  const now = new Date().toISOString()
  const orderId = await adapter.createDoc(STORAGE_COLLECTIONS.orders, {
    status: 'Draft',
    clientId,
    clientName: 'Optica Updated',
    clientNif: 'PT123',
    clientPo: '',
    notes: '',
    orderDate: now.slice(0, 10),
    billing: {
      name: 'Optica Updated',
      nif: 'PT123',
      contactName: 'Ana',
      phone: '123',
      email: 'a@demo.test',
      address: 'Street 1',
    },
    shipping: {
      recipient: 'Shop',
      careOf: '',
      phone: '123',
      address: 'Street 1',
      postalCode: '1000',
    },
    company: {
      name: 'Lens Manager Demo',
      nif: 'PT 000000000',
      address: '123 Demo Street',
      phone: '+351 000 000 000',
      email: 'demo@lensmanager.example',
      mdrNote: 'MDR note',
      ivaNote: 'IVA note',
      iban: 'PT50 0000 0000 0000 0000 0000 0',
      bankName: 'Demo Bank',
      accountHolder: 'Lens Manager Demo',
    },
    orderDiscount: { percent: 10 },
    clientDefaultDiscount: { percent: 5 },
    paymentTerms: 'net_30',
    lines,
    createdAt: now,
    updatedAt: now,
  })

  const pedSeq = await adapter.allocateCounter('ped', '2608')
  const pedNumber = `PED-2608${String(pedSeq).padStart(4, '0')}`
  const draft = await adapter.getDoc(STORAGE_COLLECTIONS.orders, orderId)
  await adapter.setDoc(STORAGE_COLLECTIONS.orders, orderId, {
    ...draft!,
    status: 'Confirmed',
    pedNumber,
    confirmedAt: now,
    updatedAt: now,
  })
  const confirmed = await adapter.getDoc(STORAGE_COLLECTIONS.orders, orderId)
  assert((confirmed!.status as string) === 'Confirmed', 'confirm')
  assert((confirmed!.pedNumber as string) === pedNumber, 'ped assigned')

  // Duplicate as draft
  const dupId = await adapter.createDoc(STORAGE_COLLECTIONS.orders, {
    ...confirmed!,
    status: 'Draft',
    pedNumber: undefined,
    confirmedAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
  const dup = await adapter.getDoc(STORAGE_COLLECTIONS.orders, dupId)
  assert((dup!.status as string) === 'Draft', 'duplicate draft')
  await adapter.deleteDoc(STORAGE_COLLECTIONS.orders, dupId)
  assert(
    (await adapter.getDoc(STORAGE_COLLECTIONS.orders, dupId)) === null,
    'delete draft',
  )
  console.log('OK orders flow', { pedNumber, eur })

  console.log('=== 5.4 PDF definition ===')
  const { buildOrderPdfDefinition } = await import('../src/lib/orderPdf')
  const pdfOrder = {
    id: orderId,
    status: 'Confirmed' as const,
    clientId,
    clientName: 'Optica Updated',
    clientNif: 'PT123',
    clientPo: 'PO1',
    notes: 'Smoke note',
    orderDate: now.slice(0, 10),
    billing: confirmed!.billing as never,
    shipping: confirmed!.shipping as never,
    company: confirmed!.company as never,
    orderDiscount: { percent: 10 },
    clientDefaultDiscount: { percent: 5 },
    paymentTerms: 'net_30',
    lines,
    pedNumber,
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
  }
  const def = buildOrderPdfDefinition(pdfOrder, 'pedido')
  assert(Array.isArray(def.content), 'pdf content')
  const json = JSON.stringify(def)
  assert(!json.includes('SEKAI'), 'no SEKAI in PDF')
  assert(!json.includes('Fukujin'), 'no Fukujin in PDF')
  assert(!json.includes('sekaioptical'), 'no sekaioptical in PDF')
  assert(!json.includes('519165780'), 'no source-product NIF in PDF')
  assert(!json.includes('0007 0000 0085 3635'), 'no source-product IBAN in PDF')
  assert(json.includes('ORDER') || json.includes('Lens Manager'), 'english labels')
  assert(json.includes('Net 30'), 'payment badge on order PDF')
  assert(!json.includes('Payment terms and bank details'), 'no bank block on order PDF')
  const pfSeq = await adapter.allocateCounter('pf', '2608')
  const pfNumber = `PF-2608${String(pfSeq).padStart(4, '0')}`
  const proforma = buildOrderPdfDefinition(
    { ...pdfOrder, pfNumber, pfIssuedAt: now },
    'proforma',
  )
  const pfJson = JSON.stringify(proforma)
  assert(pfJson.includes('PROFORMA'), 'proforma label')
  assert(pfJson.includes('Payment terms and bank details'), 'bank block on proforma')
  assert(pfJson.includes('Demo Bank'), 'demo bank fallback')
  console.log('OK PDF definitions', { pfNumber })

  console.log('=== 5.5 Sales-by-SKU ===')
  const { buildSalesReport } = await import('../src/lib/salesReport')
  const rows = buildSalesReport(
    [pdfOrder],
    now.slice(0, 10),
    now.slice(0, 10),
  )
  assert(rows.length === 1, 'one sku row')
  assert(rows[0].qty === 2, 'qty')
  assert(rows[0].amountNet > 0, 'amount')
  console.log('OK sales report', rows[0])

  console.log('=== 5.6 Theme + company settings ===')
  await adapter.setSingleton(STORAGE_SINGLETONS.company, {
    name: 'Lens Manager Demo',
    nif: 'PT 000000000',
    address: '123 Demo Street',
    phone: '+351 000 000 000',
    email: 'demo@lensmanager.example',
    mdrNote: 'MDR',
    ivaNote: 'IVA',
  })
  const company = await adapter.getSingleton(STORAGE_SINGLETONS.company)
  assert((company!.name as string) === 'Lens Manager Demo', 'company settings')
  localStorage.setItem('lens-manager-theme', 'dark')
  assert(localStorage.getItem('lens-manager-theme') === 'dark', 'theme persist')
  console.log('OK theme + settings')

  console.log('\nAll domain smoke checks passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
