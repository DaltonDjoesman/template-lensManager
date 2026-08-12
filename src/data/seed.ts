/**
 * Versioned fictional demo dataset for Lens Manager.
 * Stable IDs keep Restore seed deterministic across wipes.
 */
import { SEED_PRODUCTS } from '../lib/products'
import { DEFAULT_COMPANY_SETTINGS } from '../types/companySettings'
import type { Client } from '../types/client'
import type { CompanySettings } from '../types/companySettings'
import { buildLineSku, type Order } from '../types/order'
import type { Product } from '../types/product'

export const SEED_VERSION = 2

/** localStorage key for first-run / wipe / restore marker. */
export const DEMO_SEED_MARKER_KEY = 'lens-manager:demo-seed-marker'

export type DemoSeedMarkerState = 'seeded' | 'wiped'

export interface DemoSeedMarker {
  version: number
  state: DemoSeedMarkerState
}

export const SEED_COMPANY_SETTINGS: CompanySettings = {
  ...DEFAULT_COMPANY_SETTINGS,
}

const PRODUCT_IDS = [
  'seed-prod-mid-clear',
  'seed-prod-mid-blue',
  'seed-prod-std-clear',
  'seed-prod-std-blue',
  'seed-prod-hi-clear',
  'seed-prod-hi-blue',
  'seed-prod-ult-clear',
  'seed-prod-ult-dual',
] as const

export const SEED_CLIENTS: Client[] = [
  {
    id: 'seed-client-aurora',
    billing: {
      name: 'Aurora Optical Studio',
      nif: 'PT 501234567',
      contactName: 'Ana Ribeiro',
      phone: '+351 210 100 201',
      email: 'orders@aurora-optical.example',
      address: 'Rua das Lentes 12 | 1200-100 Lisboa',
    },
    deliveryLocations: [
      {
        id: 'seed-loc-aurora-main',
        label: 'Lisbon shop',
        recipient: 'Aurora Optical Studio',
        careOf: 'Receiving desk',
        phone: '+351 210 100 201',
        address: 'Rua das Lentes 12',
        postalCode: '1200-100',
        isPrimary: true,
      },
      {
        id: 'seed-loc-aurora-lab',
        label: 'Lab annex',
        recipient: 'Aurora Lab',
        careOf: 'Cutting room',
        phone: '+351 210 100 202',
        address: 'Travessa do Foco 3',
        postalCode: '1200-110',
        isPrimary: false,
      },
    ],
    defaultDiscount: { percent: 5 },
  },
  {
    id: 'seed-client-harbor',
    billing: {
      name: 'Harbor Vision Group',
      nif: 'PT 502345678',
      contactName: 'Miguel Costa',
      phone: '+351 220 200 301',
      email: 'purchasing@harbor-vision.example',
      address: 'Av. do Porto 88 | 4000-200 Porto',
    },
    deliveryLocations: [
      {
        id: 'seed-loc-harbor-hq',
        label: 'Porto HQ',
        recipient: 'Harbor Vision Group',
        careOf: 'Warehouse B',
        phone: '+351 220 200 301',
        address: 'Av. do Porto 88',
        postalCode: '4000-200',
        isPrimary: true,
      },
    ],
    defaultDiscount: { percent: 8, amountEur: 10 },
  },
  {
    id: 'seed-client-northglass',
    billing: {
      name: 'Northglass Opticians',
      nif: 'PT 503456789',
      contactName: 'Sofia Mendes',
      phone: '+351 253 300 401',
      email: 'sofia@northglass.example',
      address: 'Praça Central 4 | 4700-050 Braga',
    },
    deliveryLocations: [
      {
        id: 'seed-loc-north-main',
        label: 'Braga store',
        recipient: 'Northglass Opticians',
        careOf: 'Sofia Mendes',
        phone: '+351 253 300 401',
        address: 'Praça Central 4',
        postalCode: '4700-050',
        isPrimary: true,
      },
    ],
    defaultDiscount: {},
  },
  {
    id: 'seed-client-vista',
    billing: {
      name: 'Vista Clear Retail',
      nif: 'PT 504567890',
      contactName: 'João Almeida',
      phone: '+351 289 400 501',
      email: 'ops@vistaclear.example',
      address: 'Rua do Farol 21 | 8000-300 Faro',
    },
    deliveryLocations: [
      {
        id: 'seed-loc-vista-main',
        label: 'Faro retail',
        recipient: 'Vista Clear Retail',
        careOf: 'Front counter',
        phone: '+351 289 400 501',
        address: 'Rua do Farol 21',
        postalCode: '8000-300',
        isPrimary: true,
      },
      {
        id: 'seed-loc-vista-depot',
        label: 'Regional depot',
        recipient: 'Vista Clear Depot',
        careOf: 'Logistics',
        phone: '+351 289 400 502',
        address: 'Zona Industrial Lote 7',
        postalCode: '8005-150',
        isPrimary: false,
      },
    ],
    defaultDiscount: { amountEur: 15 },
  },
]

export const SEED_CATALOG: Product[] = SEED_PRODUCTS.map((product, index) => ({
  id: PRODUCT_IDS[index] ?? `seed-prod-${index + 1}`,
  ...product,
}))

function line(
  id: string,
  product: Product,
  sph: number,
  cyl: number,
  qty: number,
  discountPercent?: number,
) {
  return {
    id,
    productId: product.id,
    familySku: product.sku,
    description: product.description,
    sph,
    cyl,
    qty,
    unitPrice: product.unitPrice,
    lineSku: buildLineSku(product.sku, sph, cyl),
    ...(discountPercent !== undefined ? { discountPercent } : {}),
  }
}

const p0 = SEED_CATALOG[0]!
const p2 = SEED_CATALOG[2]!
const p4 = SEED_CATALOG[4]!
const p5 = SEED_CATALOG[5]!
const company = SEED_COMPANY_SETTINGS

const aurora = SEED_CLIENTS[0]!
const harbor = SEED_CLIENTS[1]!
const north = SEED_CLIENTS[2]!
const vista = SEED_CLIENTS[3]!

/** Sample orders spanning Draft / Confirmed / Completed / Cancelled. */
export const SEED_ORDERS: Order[] = [
  {
    id: 'seed-order-draft',
    status: 'Draft',
    clientId: aurora.id,
    clientName: aurora.billing.name,
    clientNif: aurora.billing.nif,
    clientPo: 'PO-AUR-104',
    notes: 'Waiting on final CYL confirmation from the shop.',
    orderDate: '2026-08-08',
    billing: { ...aurora.billing },
    shipping: {
      recipient: aurora.deliveryLocations[0]!.recipient,
      careOf: aurora.deliveryLocations[0]!.careOf,
      phone: aurora.deliveryLocations[0]!.phone,
      address: aurora.deliveryLocations[0]!.address,
      postalCode: aurora.deliveryLocations[0]!.postalCode,
    },
    company: { ...company },
    deliveryLocationId: aurora.deliveryLocations[0]!.id,
    orderDiscount: { ...aurora.defaultDiscount },
    clientDefaultDiscount: { ...aurora.defaultDiscount },
    lines: [
      line('seed-line-d1', p0, -2.25, -1.0, 2),
      line('seed-line-d2', p2, -1.75, -0.5, 1, 10),
    ],
    createdAt: '2026-08-08T09:15:00.000Z',
    updatedAt: '2026-08-08T09:15:00.000Z',
  },
  {
    id: 'seed-order-confirmed',
    status: 'Confirmed',
    clientId: harbor.id,
    clientName: harbor.billing.name,
    clientNif: harbor.billing.nif,
    clientPo: 'HVG-8821',
    notes: '',
    orderDate: '2026-08-05',
    billing: { ...harbor.billing },
    shipping: {
      recipient: harbor.deliveryLocations[0]!.recipient,
      careOf: harbor.deliveryLocations[0]!.careOf,
      phone: harbor.deliveryLocations[0]!.phone,
      address: harbor.deliveryLocations[0]!.address,
      postalCode: harbor.deliveryLocations[0]!.postalCode,
    },
    company: { ...company },
    deliveryLocationId: harbor.deliveryLocations[0]!.id,
    orderDiscount: { ...harbor.defaultDiscount },
    clientDefaultDiscount: { ...harbor.defaultDiscount },
    lines: [
      line('seed-line-c1', p2, -4.5, -1.25, 4),
      line('seed-line-c2', p4, -5.25, -2.5, 2),
    ],
    pedNumber: 'PED2608-0001',
    pfNumber: 'PF2608-0001',
    confirmedAt: '2026-08-05T14:22:00.000Z',
    createdAt: '2026-08-05T11:00:00.000Z',
    updatedAt: '2026-08-05T14:22:00.000Z',
  },
  {
    id: 'seed-order-completed',
    status: 'Completed',
    clientId: vista.id,
    clientName: vista.billing.name,
    clientNif: vista.billing.nif,
    clientPo: 'VC-77',
    notes: 'Delivered to regional depot.',
    orderDate: '2026-07-28',
    billing: { ...vista.billing },
    shipping: {
      recipient: vista.deliveryLocations[1]!.recipient,
      careOf: vista.deliveryLocations[1]!.careOf,
      phone: vista.deliveryLocations[1]!.phone,
      address: vista.deliveryLocations[1]!.address,
      postalCode: vista.deliveryLocations[1]!.postalCode,
    },
    company: { ...company },
    deliveryLocationId: vista.deliveryLocations[1]!.id,
    orderDiscount: { ...vista.defaultDiscount },
    clientDefaultDiscount: { ...vista.defaultDiscount },
    lines: [
      line('seed-line-x1', p5, -8.0, -1.75, 3),
      line('seed-line-x2', p0, 2.0, -0.25, 6),
    ],
    pedNumber: 'PED2607-0003',
    pfNumber: 'PF2607-0002',
    confirmedAt: '2026-07-28T16:05:00.000Z',
    createdAt: '2026-07-28T10:30:00.000Z',
    updatedAt: '2026-07-30T09:00:00.000Z',
  },
  {
    id: 'seed-order-cancelled',
    status: 'Cancelled',
    clientId: north.id,
    clientName: north.billing.name,
    clientNif: north.billing.nif,
    clientPo: '',
    notes: 'Client cancelled before confirmation.',
    orderDate: '2026-08-02',
    billing: { ...north.billing },
    shipping: {
      recipient: north.deliveryLocations[0]!.recipient,
      careOf: north.deliveryLocations[0]!.careOf,
      phone: north.deliveryLocations[0]!.phone,
      address: north.deliveryLocations[0]!.address,
      postalCode: north.deliveryLocations[0]!.postalCode,
    },
    company: { ...company },
    deliveryLocationId: north.deliveryLocations[0]!.id,
    orderDiscount: {},
    clientDefaultDiscount: {},
    lines: [line('seed-line-n1', p0, -1.25, -0.5, 1)],
    createdAt: '2026-08-02T08:40:00.000Z',
    updatedAt: '2026-08-02T12:10:00.000Z',
  },
]
