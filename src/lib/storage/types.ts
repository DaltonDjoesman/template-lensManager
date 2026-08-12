/**
 * Storage adapter seam for Lens Manager domain persistence.
 * Default runtime: LocalStorageAdapter. Swap implementations without
 * rewriting UI or domain modules.
 */

export type JsonRecord = Record<string, unknown>

export interface CounterState {
  seq: number
}

export interface StorageAdapter {
  /** List all documents in a named collection (id → data without id field). */
  listDocs(collection: string): Promise<Array<{ id: string; data: JsonRecord }>>

  getDoc(collection: string, id: string): Promise<JsonRecord | null>

  /** Create a new document with a generated id; returns the id. */
  createDoc(collection: string, data: JsonRecord): Promise<string>

  /** Replace/merge document data under an existing id. */
  setDoc(collection: string, id: string, data: JsonRecord): Promise<void>

  deleteDoc(collection: string, id: string): Promise<void>

  /** Read a singleton document (e.g. company settings). */
  getSingleton(key: string): Promise<JsonRecord | null>

  setSingleton(key: string, data: JsonRecord): Promise<void>

  /**
   * Atomically increment a monthly counter and return the next sequence
   * (1-based). kind is typically `ped` or `pf`; aamm is YYMM.
   */
  allocateCounter(kind: string, aamm: string): Promise<number>
}

export const STORAGE_COLLECTIONS = {
  clients: 'clients',
  products: 'products',
  orders: 'orders',
} as const

export const STORAGE_SINGLETONS = {
  company: 'company',
} as const
