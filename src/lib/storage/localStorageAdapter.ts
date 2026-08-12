import type { CounterState, JsonRecord, StorageAdapter } from './types'

const PREFIX = 'lens-manager'

function collectionKey(collection: string): string {
  return `${PREFIX}:collection:${collection}`
}

function singletonKey(key: string): string {
  return `${PREFIX}:singleton:${key}`
}

function countersKey(): string {
  return `${PREFIX}:counters`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function newId(): string {
  return crypto.randomUUID()
}

type CollectionMap = Record<string, JsonRecord>
type CountersMap = Record<string, CounterState>

/**
 * Browser localStorage-backed adapter. Suitable for the portfolio demo
 * (same-origin persistence, no backend).
 */
export class LocalStorageAdapter implements StorageAdapter {
  async listDocs(
    collection: string,
  ): Promise<Array<{ id: string; data: JsonRecord }>> {
    const map = readJson<CollectionMap>(collectionKey(collection), {})
    return Object.entries(map).map(([id, data]) => ({ id, data }))
  }

  async getDoc(collection: string, id: string): Promise<JsonRecord | null> {
    const map = readJson<CollectionMap>(collectionKey(collection), {})
    return map[id] ?? null
  }

  async createDoc(collection: string, data: JsonRecord): Promise<string> {
    const map = readJson<CollectionMap>(collectionKey(collection), {})
    const id = newId()
    map[id] = data
    writeJson(collectionKey(collection), map)
    return id
  }

  async setDoc(
    collection: string,
    id: string,
    data: JsonRecord,
  ): Promise<void> {
    const map = readJson<CollectionMap>(collectionKey(collection), {})
    map[id] = data
    writeJson(collectionKey(collection), map)
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    const map = readJson<CollectionMap>(collectionKey(collection), {})
    delete map[id]
    writeJson(collectionKey(collection), map)
  }

  async getSingleton(key: string): Promise<JsonRecord | null> {
    return readJson<JsonRecord | null>(singletonKey(key), null)
  }

  async setSingleton(key: string, data: JsonRecord): Promise<void> {
    writeJson(singletonKey(key), data)
  }

  async allocateCounter(kind: string, aamm: string): Promise<number> {
    const counters = readJson<CountersMap>(countersKey(), {})
    const counterId = `${kind}-${aamm}`
    const current = counters[counterId]?.seq ?? 0
    const next = current + 1
    counters[counterId] = { seq: next }
    writeJson(countersKey(), counters)
    return next
  }
}
