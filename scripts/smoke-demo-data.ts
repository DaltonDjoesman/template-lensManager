/**
 * Node smoke test for demo seed / wipe / restore (localStorage polyfill).
 * Run: npx tsx scripts/smoke-demo-data.ts
 */

// Minimal localStorage for Node
const store = new Map<string, string>()
const localStorage = {
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null
  },
  setItem(key: string, value: string) {
    store.set(key, String(value))
  },
  removeItem(key: string) {
    store.delete(key)
  },
  clear() {
    store.clear()
  },
}
;(globalThis as unknown as { localStorage: typeof localStorage }).localStorage =
  localStorage

if (!globalThis.crypto?.randomUUID) {
  const { randomUUID } = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID },
  })
}

const {
  ensureFirstRunSeed,
  ensureDemoSeed,
  wipeAllDemoData,
  restoreSeedDemoData,
} = await import('../src/lib/demoData.ts')
const { listClients } = await import('../src/lib/clients.ts')
const { listProducts } = await import('../src/lib/products.ts')
const { listOrders } = await import('../src/lib/orders.ts')
const { loadCompanySettings } = await import('../src/lib/companySettings.ts')
const { DEMO_SEED_MARKER_KEY, SEED_VERSION } = await import('../src/data/seed.ts')

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// 1) First visit seeds
store.clear()
const seeded = await ensureFirstRunSeed()
assert(seeded === true, 'first run should seed')
assert((await listClients()).length >= 3, 'clients seeded')
assert((await listProducts()).length >= 5, 'products seeded')
assert((await listOrders()).length >= 3, 'orders seeded')
assert(localStorage.getItem(DEMO_SEED_MARKER_KEY), 'marker set after seed')

// Second boot must not re-seed blindly (marker present)
const again = await ensureFirstRunSeed()
assert(again === false, 'second boot should skip seed')

// Outdated seed version triggers migration (not after wipe)
localStorage.setItem(
  DEMO_SEED_MARKER_KEY,
  JSON.stringify({ version: SEED_VERSION - 1, state: 'seeded' }),
)
const migrated = await ensureDemoSeed()
assert(migrated === 'migrated', 'older seed version should re-apply dataset')
assert((await listProducts()).length >= 5, 'products after migration')
const markerAfterMigrate = JSON.parse(localStorage.getItem(DEMO_SEED_MARKER_KEY)!)
assert(markerAfterMigrate.version === SEED_VERSION, 'marker version bumped')

// 2) Wipe leaves empty lists and does not auto-reseed
await wipeAllDemoData()
assert((await listClients()).length === 0, 'clients empty after wipe')
assert((await listProducts()).length === 0, 'products empty after wipe')
assert((await listOrders()).length === 0, 'orders empty after wipe')
const company = await loadCompanySettings()
assert(company.name.includes('Demo') || company.name.length > 0, 'company placeholders')
const markerAfterWipe = JSON.parse(localStorage.getItem(DEMO_SEED_MARKER_KEY)!)
assert(markerAfterWipe.state === 'wiped', 'marker wiped')

const noReseed = await ensureFirstRunSeed()
assert(noReseed === false, 'wipe must not re-trigger first-run seed')
assert((await listClients()).length === 0, 'still empty after ensureFirstRunSeed')

// 3) Restore
await restoreSeedDemoData()
assert((await listClients()).length >= 3, 'clients after restore')
assert((await listProducts()).length >= 5, 'products after restore')
assert((await listOrders()).length >= 3, 'orders after restore')
const markerAfterRestore = JSON.parse(localStorage.getItem(DEMO_SEED_MARKER_KEY)!)
assert(markerAfterRestore.state === 'seeded', 'marker seeded')

console.log('smoke-demo-data: OK')
