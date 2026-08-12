/**
 * Demo lifecycle: first-run seed, wipe all, restore seed.
 * Marker semantics: absent → first visit seeds once; wipe sets state
 * `wiped` so empty storage is not auto-repopulated.
 */
import {
  DEMO_SEED_MARKER_KEY,
  SEED_CATALOG,
  SEED_CLIENTS,
  SEED_COMPANY_SETTINGS,
  SEED_ORDERS,
  SEED_VERSION,
  type DemoSeedMarker,
  type DemoSeedMarkerState,
} from '../data/seed'
import { saveCompanySettings } from './companySettings'
import { storage, STORAGE_COLLECTIONS } from './storage'
import type { JsonRecord } from './storage'

const COUNTERS_STORAGE_KEY = 'lens-manager:counters'

function readMarker(): DemoSeedMarker | null {
  try {
    const raw = localStorage.getItem(DEMO_SEED_MARKER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DemoSeedMarker>
    if (
      typeof parsed.version !== 'number' ||
      (parsed.state !== 'seeded' && parsed.state !== 'wiped')
    ) {
      return null
    }
    return { version: parsed.version, state: parsed.state }
  } catch {
    return null
  }
}

function writeMarker(state: DemoSeedMarkerState): void {
  const marker: DemoSeedMarker = { version: SEED_VERSION, state }
  localStorage.setItem(DEMO_SEED_MARKER_KEY, JSON.stringify(marker))
}

async function clearCollection(collection: string): Promise<void> {
  const docs = await storage.listDocs(collection)
  await Promise.all(docs.map((doc) => storage.deleteDoc(collection, doc.id)))
}

function clearCounters(): void {
  localStorage.removeItem(COUNTERS_STORAGE_KEY)
}

function clientPayload(client: (typeof SEED_CLIENTS)[number]): JsonRecord {
  const { id: _id, ...data } = client
  void _id
  return data as unknown as JsonRecord
}

function productPayload(product: (typeof SEED_CATALOG)[number]): JsonRecord {
  const { id: _id, ...data } = product
  void _id
  return data as unknown as JsonRecord
}

function orderPayload(order: (typeof SEED_ORDERS)[number]): JsonRecord {
  const { id: _id, ...data } = order
  void _id
  return data as unknown as JsonRecord
}

/** Write the full seed dataset (clients, catalog, orders, company). */
export async function applySeedDataset(): Promise<void> {
  await clearCollection(STORAGE_COLLECTIONS.clients)
  await clearCollection(STORAGE_COLLECTIONS.products)
  await clearCollection(STORAGE_COLLECTIONS.orders)
  clearCounters()

  for (const client of SEED_CLIENTS) {
    await storage.setDoc(
      STORAGE_COLLECTIONS.clients,
      client.id,
      clientPayload(client),
    )
  }
  for (const product of SEED_CATALOG) {
    await storage.setDoc(
      STORAGE_COLLECTIONS.products,
      product.id,
      productPayload(product),
    )
  }
  for (const order of SEED_ORDERS) {
    await storage.setDoc(
      STORAGE_COLLECTIONS.orders,
      order.id,
      orderPayload(order),
    )
  }

  await saveCompanySettings({ ...SEED_COMPANY_SETTINGS })
  writeMarker('seeded')
}

/**
 * Bootstrap demo data on load:
 * - no marker → first-run seed
 * - marker `seeded` with older SEED_VERSION → re-apply seed (catalog/orders updated)
 * - marker `wiped` → leave empty (user chose wipe)
 */
export async function ensureDemoSeed(): Promise<
  'fresh' | 'migrated' | 'skipped'
> {
  const marker = readMarker()
  if (!marker) {
    await applySeedDataset()
    return 'fresh'
  }
  if (marker.state === 'seeded' && marker.version < SEED_VERSION) {
    await applySeedDataset()
    return 'migrated'
  }
  return 'skipped'
}

/**
 * First visit only: when no demo marker exists, load seed data once.
 * After Wipe all the marker is `wiped`, so this does not repopulate.
 */
export async function ensureFirstRunSeed(): Promise<boolean> {
  const result = await ensureDemoSeed()
  return result === 'fresh'
}

/**
 * Wipe all domain data and reset company settings to neutral placeholders.
 * Sets marker to `wiped` so first-run seeding does not immediately re-run.
 */
export async function wipeAllDemoData(): Promise<void> {
  await clearCollection(STORAGE_COLLECTIONS.clients)
  await clearCollection(STORAGE_COLLECTIONS.products)
  await clearCollection(STORAGE_COLLECTIONS.orders)
  clearCounters()
  await saveCompanySettings({ ...SEED_COMPANY_SETTINGS })
  writeMarker('wiped')
}

/** Replace domain data with the fictional seed and demo company defaults. */
export async function restoreSeedDemoData(): Promise<void> {
  await applySeedDataset()
}
