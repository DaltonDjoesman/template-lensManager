import { LocalStorageAdapter } from './localStorageAdapter'
import type { StorageAdapter } from './types'

export type { StorageAdapter, JsonRecord, CounterState } from './types'
export {
  STORAGE_COLLECTIONS,
  STORAGE_SINGLETONS,
} from './types'
export { LocalStorageAdapter } from './localStorageAdapter'

/**
 * Default adapter for the Lens Manager demo (localStorage).
 *
 * --- Future Firebase-backed adapter (sketch) ---
 *
 * class FirebaseStorageAdapter implements StorageAdapter {
 *   // Wire listDocs/getDoc/createDoc/setDoc/deleteDoc to Firestore
 *   // collections (clients, products, orders) and settings/company.
 *   // Use a Firestore transaction in allocateCounter for PED/PF seqs.
 *   // Pair with Firebase Auth for multi-user sync — not required for demo.
 * }
 *
 * Then: `export const storage: StorageAdapter = new FirebaseStorageAdapter()`
 */
export const storage: StorageAdapter = new LocalStorageAdapter()
