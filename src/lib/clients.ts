import { storage, STORAGE_COLLECTIONS } from './storage'
import type { JsonRecord } from './storage'
import {
  CLIENTS_COLLECTION,
  DEFAULT_DELIVERY_LOCATION_LABEL,
  EMPTY_CLIENT_BILLING,
  createDeliveryLocation,
  normalizePaymentTerms,
  paymentTermsLabel,
  type Client,
  type ClientBilling,
  type ClientDeliveryLocation,
  type ClientInput,
  type DefaultDiscount,
  type PaymentTerms,
} from '../types/client'

export class DuplicateNifError extends Error {
  constructor(nif: string) {
    super(`A client with this NIF already exists: ${nif}`)
    this.name = 'DuplicateNifError'
  }
}

// Keep collection name constant for documentation / future Firebase mapping.
void CLIENTS_COLLECTION

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return value
}

function normalizeBilling(raw: unknown): ClientBilling {
  const data = (raw ?? {}) as Partial<ClientBilling>
  return {
    ...EMPTY_CLIENT_BILLING,
    name: asString(data.name),
    nif: asString(data.nif),
    contactName: asString(data.contactName),
    phone: asString(data.phone),
    email: asString(data.email),
    address: asString(data.address),
  }
}

function normalizeDiscount(raw: unknown): DefaultDiscount {
  const data = (raw ?? {}) as Partial<DefaultDiscount>
  const discount: DefaultDiscount = {}
  const percent = asOptionalNumber(data.percent)
  const amountEur = asOptionalNumber(data.amountEur)
  if (percent !== undefined) discount.percent = percent
  if (amountEur !== undefined) discount.amountEur = amountEur
  return discount
}

/** Ensure exactly one primary when the list is non-empty. */
export function normalizePrimaryLocations(
  locations: ClientDeliveryLocation[],
): ClientDeliveryLocation[] {
  if (locations.length === 0) return []

  const primaryIndex = locations.findIndex((loc) => loc.isPrimary)
  const indexToKeep = primaryIndex >= 0 ? primaryIndex : 0

  return locations.map((loc, index) => ({
    ...loc,
    isPrimary: index === indexToKeep,
  }))
}

function normalizeOneLocation(raw: unknown): ClientDeliveryLocation | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<ClientDeliveryLocation>
  const id = asString(data.id) || crypto.randomUUID()
  return {
    id,
    label: asString(data.label),
    recipient: asString(data.recipient),
    careOf: asString(data.careOf),
    phone: asString(data.phone),
    address: asString(data.address),
    postalCode: asString(data.postalCode),
    isPrimary: Boolean(data.isPrimary),
  }
}

function legacyShippingToPrimary(raw: unknown): ClientDeliveryLocation | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  return createDeliveryLocation({
    label: DEFAULT_DELIVERY_LOCATION_LABEL,
    recipient: asString(data.recipient),
    careOf: asString(data.careOf),
    phone: asString(data.phone),
    address: asString(data.address),
    postalCode: asString(data.postalCode),
    isPrimary: true,
  })
}

/**
 * Prefer `deliveryLocations[]`. If missing/empty and legacy `shipping` exists,
 * synthesize one primary location (label: Primary delivery).
 */
export function normalizeDeliveryLocations(
  data: JsonRecord,
): ClientDeliveryLocation[] {
  const rawList = data.deliveryLocations
  if (Array.isArray(rawList) && rawList.length > 0) {
    const mapped = rawList
      .map(normalizeOneLocation)
      .filter((loc): loc is ClientDeliveryLocation => loc !== null)
    return normalizePrimaryLocations(mapped)
  }

  const fromLegacy = legacyShippingToPrimary(data.shipping)
  if (fromLegacy) return [fromLegacy]

  return []
}

function mapClientDoc(id: string, data: JsonRecord): Client {
  return {
    id,
    billing: normalizeBilling(data.billing),
    deliveryLocations: normalizeDeliveryLocations(data),
    defaultDiscount: normalizeDiscount(data.defaultDiscount),
    paymentTerms: normalizePaymentTerms(data.paymentTerms),
  }
}

function trimLocation(loc: ClientDeliveryLocation): ClientDeliveryLocation {
  return {
    id: loc.id,
    label: loc.label.trim(),
    recipient: loc.recipient.trim(),
    careOf: loc.careOf.trim(),
    phone: loc.phone.trim(),
    address: loc.address.trim(),
    postalCode: loc.postalCode.trim(),
    isPrimary: loc.isPrimary,
  }
}

function toStoredPayload(input: ClientInput): JsonRecord {
  const discount: DefaultDiscount = {}
  if (
    input.defaultDiscount.percent !== undefined &&
    !Number.isNaN(input.defaultDiscount.percent)
  ) {
    discount.percent = input.defaultDiscount.percent
  }
  if (
    input.defaultDiscount.amountEur !== undefined &&
    !Number.isNaN(input.defaultDiscount.amountEur)
  ) {
    discount.amountEur = input.defaultDiscount.amountEur
  }

  const deliveryLocations = normalizePrimaryLocations(
    input.deliveryLocations.map(trimLocation),
  )

  return {
    billing: {
      name: input.billing.name.trim(),
      nif: input.billing.nif.trim(),
      contactName: input.billing.contactName.trim(),
      phone: input.billing.phone.trim(),
      email: input.billing.email.trim(),
      address: input.billing.address.trim(),
    },
    deliveryLocations,
    defaultDiscount: discount,
    paymentTerms: normalizePaymentTerms(input.paymentTerms),
  }
}

export async function listClients(): Promise<Client[]> {
  const docs = await storage.listDocs(STORAGE_COLLECTIONS.clients)
  return docs
    .map((d) => mapClientDoc(d.id, d.data))
    .sort((a, b) => a.billing.name.localeCompare(b.billing.name))
}

export async function getClient(id: string): Promise<Client | null> {
  const data = await storage.getDoc(STORAGE_COLLECTIONS.clients, id)
  if (!data) return null
  return mapClientDoc(id, data)
}

/** Returns true if another client already uses this billing NIF. */
export async function isNifTaken(
  nif: string,
  excludeId?: string,
): Promise<boolean> {
  const normalized = nif.trim()
  if (!normalized) return false

  const clients = await listClients()
  return clients.some(
    (client) =>
      client.id !== excludeId && client.billing.nif.trim() === normalized,
  )
}

async function assertNifUnique(nif: string, excludeId?: string): Promise<void> {
  if (await isNifTaken(nif, excludeId)) {
    throw new DuplicateNifError(nif.trim())
  }
}

export async function createClient(input: ClientInput): Promise<string> {
  await assertNifUnique(input.billing.nif)
  return storage.createDoc(
    STORAGE_COLLECTIONS.clients,
    toStoredPayload(input),
  )
}

export async function updateClient(
  id: string,
  input: ClientInput,
): Promise<void> {
  const current = await getClient(id)
  const nextNif = input.billing.nif.trim()
  if (!current || current.billing.nif.trim() !== nextNif) {
    await assertNifUnique(nextNif, id)
  }
  await storage.setDoc(
    STORAGE_COLLECTIONS.clients,
    id,
    toStoredPayload(input),
  )
}

export function formatPaymentTerms(terms: PaymentTerms): string {
  return paymentTermsLabel(terms)
}

export async function deleteClient(id: string): Promise<void> {
  await storage.deleteDoc(STORAGE_COLLECTIONS.clients, id)
}

export function formatDefaultDiscount(discount: DefaultDiscount): string {
  const hasPercent =
    discount.percent !== undefined && discount.percent > 0
  const hasAmount =
    discount.amountEur !== undefined && discount.amountEur > 0

  if (hasPercent && hasAmount) {
    return `${discount.percent}% + ${formatEur(discount.amountEur!)}`
  }
  if (hasPercent) return `${discount.percent}%`
  if (hasAmount) return formatEur(discount.amountEur!)
  return 'No discount'
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function clientMatchesSearch(client: Client, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  return (
    client.billing.name.toLowerCase().includes(q) ||
    client.billing.nif.toLowerCase().includes(q)
  )
}
