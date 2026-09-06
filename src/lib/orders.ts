import { storage, STORAGE_COLLECTIONS } from './storage'
import type { JsonRecord } from './storage'
import {
  EMPTY_CLIENT_BILLING,
  type ClientBilling,
  type DefaultDiscount,
} from '../types/client'
import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from '../types/companySettings'
import {
  COUNTERS_COLLECTION,
  EMPTY_SHIPPING_SNAPSHOT,
  ORDERS_COLLECTION,
  buildLineSku,
  canTransitionStatus,
  computeOrderTotals,
  createEmptyOrderLine,
  hasOrderDiscount,
  todayIsoDate,
  yearMonthKey,
  type Order,
  type OrderInput,
  type OrderLine,
  type OrderShippingSnapshot,
  type OrderStatus,
} from '../types/order'

void ORDERS_COLLECTION
void COUNTERS_COLLECTION

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return value
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  return value
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
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

function normalizeShipping(raw: unknown): OrderShippingSnapshot {
  const data = (raw ?? {}) as Partial<OrderShippingSnapshot>
  return {
    ...EMPTY_SHIPPING_SNAPSHOT,
    recipient: asString(data.recipient),
    careOf: asString(data.careOf),
    phone: asString(data.phone),
    address: asString(data.address),
    postalCode: asString(data.postalCode),
  }
}

function normalizeCompany(raw: unknown): CompanySettings {
  const data = (raw ?? {}) as Partial<CompanySettings>
  return {
    ...DEFAULT_COMPANY_SETTINGS,
    name: asString(data.name) || DEFAULT_COMPANY_SETTINGS.name,
    nif: asString(data.nif) || DEFAULT_COMPANY_SETTINGS.nif,
    address: asString(data.address) || DEFAULT_COMPANY_SETTINGS.address,
    phone: asString(data.phone) || DEFAULT_COMPANY_SETTINGS.phone,
    email: asString(data.email) || DEFAULT_COMPANY_SETTINGS.email,
    mdrNote: asString(data.mdrNote) || DEFAULT_COMPANY_SETTINGS.mdrNote,
    ivaNote: asString(data.ivaNote) || DEFAULT_COMPANY_SETTINGS.ivaNote,
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

function normalizeLineDiscountPercent(
  value: unknown,
): number | undefined {
  const n = asOptionalNumber(value)
  if (n === undefined || n <= 0) return undefined
  return n
}

function normalizeLine(raw: unknown): OrderLine | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<OrderLine>
  const familySku = asString(data.familySku)
  const sph = asNumber(data.sph)
  const cyl = asNumber(data.cyl)
  const lineSku =
    asString(data.lineSku) ||
    (familySku ? buildLineSku(familySku, sph, cyl) : '')
  const discountPercent = normalizeLineDiscountPercent(data.discountPercent)

  return {
    id: asString(data.id) || crypto.randomUUID(),
    productId: asString(data.productId),
    familySku,
    description: asString(data.description),
    sph,
    cyl,
    qty: asNumber(data.qty, 1),
    unitPrice: asNumber(data.unitPrice),
    lineSku,
    ...(discountPercent !== undefined ? { discountPercent } : {}),
  }
}

/** Map legacy Portuguese statuses and current English values. */
function normalizeStatus(raw: unknown): OrderStatus {
  if (raw === 'Draft' || raw === 'Rascunho') return 'Draft'
  if (raw === 'Confirmed' || raw === 'Confirmado') return 'Confirmed'
  if (raw === 'Completed' || raw === 'Concluído') return 'Completed'
  if (raw === 'Cancelled' || raw === 'Cancelado') return 'Cancelled'
  return 'Draft'
}

function mapOrderDoc(id: string, data: JsonRecord): Order {
  const lines = Array.isArray(data.lines)
    ? data.lines
        .map(normalizeLine)
        .filter((line): line is OrderLine => line !== null)
    : []

  const clientDefaultDiscount = normalizeDiscount(data.clientDefaultDiscount)
  let orderDiscount = normalizeDiscount(data.orderDiscount)
  // Legacy: older orders relied on client snapshot as live fallback — seed into orderDiscount.
  if (
    !hasOrderDiscount(orderDiscount) &&
    hasOrderDiscount(clientDefaultDiscount)
  ) {
    orderDiscount = { ...clientDefaultDiscount }
  }

  return {
    id,
    status: normalizeStatus(data.status),
    clientId: asString(data.clientId),
    clientName: asString(data.clientName),
    clientNif: asString(data.clientNif),
    clientPo: asString(data.clientPo),
    notes: asString(data.notes),
    orderDate: asString(data.orderDate) || todayIsoDate(),
    billing: normalizeBilling(data.billing),
    shipping: normalizeShipping(data.shipping),
    company: normalizeCompany(data.company),
    deliveryLocationId: asOptionalString(data.deliveryLocationId),
    orderDiscount,
    clientDefaultDiscount,
    lines,
    pedNumber: asOptionalString(data.pedNumber),
    pfNumber: asOptionalString(data.pfNumber),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
    confirmedAt: asOptionalString(data.confirmedAt),
  }
}

function trimDiscount(discount: DefaultDiscount): DefaultDiscount {
  const next: DefaultDiscount = {}
  if (discount.percent !== undefined && !Number.isNaN(discount.percent)) {
    next.percent = discount.percent
  }
  if (discount.amountEur !== undefined && !Number.isNaN(discount.amountEur)) {
    next.amountEur = discount.amountEur
  }
  return next
}

function toStoredPayload(input: OrderInput): JsonRecord {
  const lines = input.lines.map((line) => {
    const familySku = line.familySku.trim()
    const sph = line.sph
    const cyl = line.cyl
    const discountPercent = normalizeLineDiscountPercent(line.discountPercent)
    const payload: JsonRecord = {
      id: line.id,
      productId: line.productId,
      familySku,
      description: line.description.trim(),
      sph,
      cyl,
      qty: line.qty,
      unitPrice: line.unitPrice,
      lineSku:
        line.lineSku.trim() ||
        (familySku ? buildLineSku(familySku, sph, cyl) : ''),
    }
    if (discountPercent !== undefined) {
      payload.discountPercent = discountPercent
    }
    return payload
  })

  const payload: JsonRecord = {
    status: input.status,
    clientId: input.clientId,
    clientName: input.clientName.trim(),
    clientNif: input.clientNif.trim(),
    clientPo: input.clientPo.trim(),
    notes: input.notes.trim(),
    orderDate: input.orderDate,
    billing: {
      name: input.billing.name.trim(),
      nif: input.billing.nif.trim(),
      contactName: input.billing.contactName.trim(),
      phone: input.billing.phone.trim(),
      email: input.billing.email.trim(),
      address: input.billing.address.trim(),
    },
    shipping: {
      recipient: input.shipping.recipient.trim(),
      careOf: input.shipping.careOf.trim(),
      phone: input.shipping.phone.trim(),
      address: input.shipping.address.trim(),
      postalCode: input.shipping.postalCode.trim(),
    },
    company: {
      name: input.company.name.trim(),
      nif: input.company.nif.trim(),
      address: input.company.address.trim(),
      phone: input.company.phone.trim(),
      email: input.company.email.trim(),
      mdrNote: input.company.mdrNote.trim(),
      ivaNote: input.company.ivaNote.trim(),
    },
    orderDiscount: trimDiscount(input.orderDiscount),
    clientDefaultDiscount: trimDiscount(input.clientDefaultDiscount),
    lines,
  }

  if (input.deliveryLocationId) {
    payload.deliveryLocationId = input.deliveryLocationId
  }

  if (input.pedNumber) payload.pedNumber = input.pedNumber
  if (input.pfNumber) payload.pfNumber = input.pfNumber
  if (input.confirmedAt) payload.confirmedAt = input.confirmedAt

  return payload
}

export {
  DEFAULT_ORDER_LIST_SORT,
  ORDER_SORT_DEFAULT_DIRECTION,
  applyOrderListQuery,
  filterOrders,
  sortOrders,
  type OrderListFilters,
  type OrderListSort,
  type OrderSortDirection,
  type OrderSortKey,
} from './orderListQuery'

export async function listOrders(): Promise<Order[]> {
  const docs = await storage.listDocs(STORAGE_COLLECTIONS.orders)
  return docs
    .map((d) => mapOrderDoc(d.id, d.data))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Confirmed + Completed orders whose confirmedAt falls in an inclusive
 * YYYY-MM-DD range (UTC day bounds on the ISO timestamp).
 */
export async function listSoldOrdersInConfirmationRange(
  dateFrom: string,
  dateTo: string,
): Promise<Order[]> {
  const start = `${dateFrom}T00:00:00.000Z`
  const end = `${dateTo}T23:59:59.999Z`
  const statuses: OrderStatus[] = ['Confirmed', 'Completed']

  const all = await listOrders()
  return all.filter((order) => {
    if (!statuses.includes(order.status)) return false
    if (!order.confirmedAt) return false
    return order.confirmedAt >= start && order.confirmedAt <= end
  })
}

export async function getOrder(id: string): Promise<Order | null> {
  const data = await storage.getDoc(STORAGE_COLLECTIONS.orders, id)
  if (!data) return null
  return mapOrderDoc(id, data)
}

export async function createOrder(input: OrderInput): Promise<string> {
  const now = new Date().toISOString()
  const payload = toStoredPayload({
    ...input,
    status: 'Draft',
  })
  // Drafts must not carry PED/PF
  delete payload.pedNumber
  delete payload.pfNumber
  delete payload.confirmedAt

  return storage.createDoc(STORAGE_COLLECTIONS.orders, {
    ...payload,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateOrder(
  id: string,
  input: OrderInput,
): Promise<void> {
  const existing = await getOrder(id)
  if (!existing) throw new Error('Order not found.')

  if (input.status !== existing.status) {
    if (!canTransitionStatus(existing.status, input.status)) {
      throw new Error(
        `Invalid status transition: ${existing.status} → ${input.status}`,
      )
    }
    // PED assignment is handled exclusively by confirmOrder
    if (input.status === 'Confirmed') {
      throw new Error('Use confirmOrder to assign the PED number.')
    }
  }

  const payload = toStoredPayload({
    ...input,
    status: input.status,
  })

  if (existing.pedNumber) payload.pedNumber = existing.pedNumber
  if (existing.pfNumber) payload.pfNumber = existing.pfNumber
  if (existing.confirmedAt) payload.confirmedAt = existing.confirmedAt

  // Never write PED on draft saves
  if (input.status === 'Draft') {
    delete payload.pedNumber
    delete payload.confirmedAt
  }

  await storage.setDoc(STORAGE_COLLECTIONS.orders, id, {
    ...payload,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Increment monthly counter and return formatted number, e.g. PED-26080001.
 */
async function allocateMonthlyNumber(
  kind: 'ped' | 'pf',
  prefix: 'PED' | 'PF',
  aamm = yearMonthKey(),
): Promise<string> {
  const seq = await storage.allocateCounter(kind, aamm)
  return `${prefix}-${aamm}${String(seq).padStart(4, '0')}`
}

export async function allocatePedNumber(
  aamm = yearMonthKey(),
): Promise<string> {
  return allocateMonthlyNumber('ped', 'PED', aamm)
}

export async function allocatePfNumber(aamm = yearMonthKey()): Promise<string> {
  return allocateMonthlyNumber('pf', 'PF', aamm)
}

/**
 * Confirm a draft: assign PED and set status Confirmed.
 * Blocks when there are zero lines.
 */
export async function confirmOrder(id: string): Promise<Order> {
  const order = await getOrder(id)
  if (!order) throw new Error('Order not found.')

  if (order.status !== 'Draft') {
    throw new Error('Only draft orders can be confirmed.')
  }
  if (order.lines.length === 0) {
    throw new Error('Cannot confirm an order with no lines.')
  }
  if (order.pedNumber) {
    throw new Error('This order already has a PED number.')
  }

  const aamm = yearMonthKey()
  const now = new Date().toISOString()
  const pedNumber = await allocatePedNumber(aamm)

  await storage.setDoc(STORAGE_COLLECTIONS.orders, id, {
    ...toStoredPayload({
      ...order,
      status: 'Confirmed',
      pedNumber,
      confirmedAt: now,
    }),
    createdAt: order.createdAt,
    updatedAt: now,
    pedNumber,
    confirmedAt: now,
  })

  const updated = await getOrder(id)
  if (!updated) throw new Error('Order not found after confirmation.')
  return updated
}

/**
 * Ensure the order has a PF number (allocate on first proforma), persist, return it.
 */
export async function ensurePfNumber(id: string): Promise<string> {
  const existing = await getOrder(id)
  if (!existing) throw new Error('Order not found.')
  if (existing.pfNumber) return existing.pfNumber

  const aamm = yearMonthKey()
  const now = new Date().toISOString()
  const pfNumber = await allocatePfNumber(aamm)

  await storage.setDoc(STORAGE_COLLECTIONS.orders, id, {
    ...toStoredPayload({
      ...existing,
      pfNumber,
    }),
    createdAt: existing.createdAt,
    updatedAt: now,
    pfNumber,
    ...(existing.pedNumber ? { pedNumber: existing.pedNumber } : {}),
    ...(existing.confirmedAt ? { confirmedAt: existing.confirmedAt } : {}),
  })

  return pfNumber
}

/** Duplicate into a new Draft without PED/PF. */
export async function duplicateOrder(id: string): Promise<string> {
  const source = await getOrder(id)
  if (!source) throw new Error('Order not found.')

  const input: OrderInput = {
    status: 'Draft',
    clientId: source.clientId,
    clientName: source.clientName,
    clientNif: source.clientNif,
    clientPo: source.clientPo,
    notes: source.notes,
    orderDate: todayIsoDate(),
    billing: { ...source.billing },
    shipping: { ...source.shipping },
    company: { ...source.company },
    deliveryLocationId: source.deliveryLocationId,
    orderDiscount: { ...source.orderDiscount },
    clientDefaultDiscount: { ...source.clientDefaultDiscount },
    lines: source.lines.map((line) =>
      createEmptyOrderLine({
        productId: line.productId,
        familySku: line.familySku,
        description: line.description,
        sph: line.sph,
        cyl: line.cyl,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineSku: line.lineSku,
        ...(line.discountPercent !== undefined &&
        Number.isFinite(line.discountPercent) &&
        line.discountPercent > 0
          ? { discountPercent: line.discountPercent }
          : {}),
      }),
    ),
  }

  return createOrder(input)
}

/** Hard-delete only drafts. Confirmed orders must be cancelled. */
export async function deleteOrder(id: string): Promise<void> {
  const existing = await getOrder(id)
  if (!existing) throw new Error('Order not found.')
  if (existing.status !== 'Draft') {
    throw new Error(
      'Only drafts can be deleted. Cancel the order instead of deleting it.',
    )
  }
  await storage.deleteDoc(STORAGE_COLLECTIONS.orders, id)
}

export function orderNetTotal(order: Order): number {
  return computeOrderTotals(order.lines, order.orderDiscount).subtotalNet
}

export function orderPieces(order: Order): number {
  return computeOrderTotals(order.lines, order.orderDiscount).pieces
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatOrderDate(isoDate: string): string {
  if (!isoDate) return '—'
  const day = isoDate.slice(0, 10)
  const [y, m, d] = day.split('-')
  if (!y || !m || !d || d.length < 2) return isoDate
  return `${d}/${m}/${y}`
}
