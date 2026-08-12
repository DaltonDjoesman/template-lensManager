import { storage, STORAGE_COLLECTIONS } from './storage'
import type { JsonRecord } from './storage'
import {
  PRODUCTS_COLLECTION,
  type Product,
  type ProductInput,
} from '../types/product'

void PRODUCTS_COLLECTION

export class DuplicateSkuError extends Error {
  constructor(sku: string) {
    super(`This SKU code already exists in the catalog: ${sku}`)
    this.name = 'DuplicateSkuError'
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return value
}

function mapProductDoc(id: string, data: JsonRecord): Product {
  return {
    id,
    sku: asString(data.sku),
    description: asString(data.description),
    unitPrice: asNumber(data.unitPrice),
    sphMin: asNumber(data.sphMin),
    sphMax: asNumber(data.sphMax),
    cylMin: asNumber(data.cylMin),
    cylMax: asNumber(data.cylMax),
  }
}

function toStoredPayload(input: ProductInput): JsonRecord {
  return {
    sku: input.sku.trim(),
    description: input.description.trim(),
    unitPrice: input.unitPrice,
    sphMin: input.sphMin,
    sphMax: input.sphMax,
    cylMin: input.cylMin,
    cylMax: input.cylMax,
  }
}

/** Returns true if another product already uses this SKU. */
export async function isSkuTaken(
  sku: string,
  excludeId?: string,
): Promise<boolean> {
  const normalized = sku.trim()
  if (!normalized) return false

  const docs = await storage.listDocs(STORAGE_COLLECTIONS.products)
  return docs.some(
    (d) => d.id !== excludeId && asString(d.data.sku) === normalized,
  )
}

async function assertSkuUnique(sku: string, excludeId?: string): Promise<void> {
  if (await isSkuTaken(sku, excludeId)) {
    throw new DuplicateSkuError(sku.trim())
  }
}

export async function listProducts(): Promise<Product[]> {
  const docs = await storage.listDocs(STORAGE_COLLECTIONS.products)
  return docs
    .map((d) => mapProductDoc(d.id, d.data))
    .sort((a, b) => a.sku.localeCompare(b.sku))
}

export async function getProduct(id: string): Promise<Product | null> {
  const data = await storage.getDoc(STORAGE_COLLECTIONS.products, id)
  if (!data) return null
  return mapProductDoc(id, data)
}

export async function createProduct(input: ProductInput): Promise<string> {
  await assertSkuUnique(input.sku)
  return storage.createDoc(
    STORAGE_COLLECTIONS.products,
    toStoredPayload(input),
  )
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<void> {
  await assertSkuUnique(input.sku, id)
  await storage.setDoc(
    STORAGE_COLLECTIONS.products,
    id,
    toStoredPayload(input),
  )
}

export async function deleteProduct(id: string): Promise<void> {
  await storage.deleteDoc(STORAGE_COLLECTIONS.products, id)
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatDiopter(value: number): string {
  const formatted = value.toFixed(2)
  if (value > 0) return `+${formatted}`
  return formatted
}

export function formatAmplitudeRange(min: number, max: number): string {
  return `${formatDiopter(min)} to ${formatDiopter(max)}`
}

export function productMatchesSearch(
  product: Product,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  return (
    product.sku.toLowerCase().includes(q) ||
    product.description.toLowerCase().includes(q)
  )
}

/**
 * Fictional demo stock families for optional catalog seeding.
 * Distinct from any real wholesaler catalog — invent your own in production.
 * Order lines compose full SKUs as `{sku}_{sph}_{cyl}` via `buildLineSku`.
 */
export const SEED_PRODUCTS: ProductInput[] = [
  {
    sku: 'MID Clear 1.50',
    description: 'Mid-index clear stock lens (demo)',
    unitPrice: 9.45,
    sphMin: -4,
    sphMax: 4,
    cylMin: -3,
    cylMax: 0,
  },
  {
    sku: 'MID BlueCut 1.50',
    description: 'Mid-index blue-cut stock lens (demo)',
    unitPrice: 10.8,
    sphMin: -4,
    sphMax: 4,
    cylMin: -2.5,
    cylMax: 0,
  },
  {
    sku: 'STD Clear 1.60',
    description: 'Standard aspheric clear (demo)',
    unitPrice: 15.25,
    sphMin: -8,
    sphMax: 6,
    cylMin: -3,
    cylMax: 0,
  },
  {
    sku: 'STD BlueCut 1.60',
    description: 'Standard aspheric blue-cut (demo)',
    unitPrice: 16.9,
    sphMin: -8,
    sphMax: 6,
    cylMin: -2,
    cylMax: 0,
  },
  {
    sku: 'HI Clear 1.67',
    description: 'High-index thin clear (demo)',
    unitPrice: 24.5,
    sphMin: -12,
    sphMax: -2,
    cylMin: -3,
    cylMax: 0,
  },
  {
    sku: 'HI BlueCut 1.67',
    description: 'High-index thin blue-cut (demo)',
    unitPrice: 31.2,
    sphMin: -11,
    sphMax: -2,
    cylMin: -2.5,
    cylMax: 0,
  },
  {
    sku: 'ULT Clear 1.74',
    description: 'Ultra-thin clear (demo)',
    unitPrice: 52,
    sphMin: -14,
    sphMax: -5,
    cylMin: -2.5,
    cylMax: 0,
  },
  {
    sku: 'ULT DualAsp 1.74',
    description: 'Ultra-thin dual-aspheric (demo)',
    unitPrice: 78.75,
    sphMin: -14,
    sphMax: -6,
    cylMin: -2.5,
    cylMax: 0,
  },
]

/**
 * Replaces the entire catalog with the reference families.
 * Returns the number of products written.
 */
export async function seedReferenceProducts(): Promise<number> {
  const existing = await listProducts()
  await Promise.all(existing.map((product) => deleteProduct(product.id)))

  for (const product of SEED_PRODUCTS) {
    await storage.createDoc(
      STORAGE_COLLECTIONS.products,
      toStoredPayload(product),
    )
  }
  return SEED_PRODUCTS.length
}
