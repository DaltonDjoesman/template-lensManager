import type { ClientBilling, DefaultDiscount } from './client'
import type { CompanySettings } from './companySettings'

/** Storage collection key: orders/{orderId} */
export const ORDERS_COLLECTION = 'orders' as const

/** Storage counters key namespace: counters/{ped|pf-AAMM} */
export const COUNTERS_COLLECTION = 'counters' as const

export const ORDER_STATUSES = [
  'Draft',
  'Confirmed',
  'Completed',
  'Cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const IVA_RATE = 0.06

/** Ship-to fields copied from a client delivery location (no label/id). */
export interface OrderShippingSnapshot {
  recipient: string
  careOf: string
  phone: string
  address: string
  postalCode: string
}

export interface OrderLine {
  /** Local row id for React keys (not catalog id). */
  id: string
  /** Catalog family product id. */
  productId: string
  familySku: string
  description: string
  sph: number
  cyl: number
  qty: number
  /** Family unit-price snapshot at selection time. */
  unitPrice: number
  /** Composite `{familySku}_{sph}_{cyl}` with two-decimal diopters. */
  lineSku: string
  /**
   * Optional line-only percentage discount. Missing / ≤0 / non-finite = unset
   * (line joins the order/client discount pool).
   */
  discountPercent?: number
}

export interface Order {
  id: string
  status: OrderStatus
  clientId: string
  clientName: string
  clientNif: string
  clientPo: string
  notes: string
  /** YYYY-MM-DD */
  orderDate: string
  billing: ClientBilling
  shipping: OrderShippingSnapshot
  company: CompanySettings
  /** Optional reference to the client location used to seed shipping. */
  deliveryLocationId?: string
  /** User-editable order-level discount (seeded from client default on select). */
  orderDiscount: DefaultDiscount
  /** Client default discount snapshotted when the client was selected (audit only). */
  clientDefaultDiscount: DefaultDiscount
  lines: OrderLine[]
  pedNumber?: string
  pfNumber?: string
  createdAt: string
  updatedAt: string
  confirmedAt?: string
}

export type OrderInput = Omit<
  Order,
  'id' | 'createdAt' | 'updatedAt' | 'pedNumber' | 'pfNumber' | 'confirmedAt'
> & {
  pedNumber?: string
  pfNumber?: string
  confirmedAt?: string
}

export const EMPTY_SHIPPING_SNAPSHOT: OrderShippingSnapshot = {
  recipient: '',
  careOf: '',
  phone: '',
  address: '',
  postalCode: '',
}

/** Canonical two-decimal diopter string (e.g. -3 → "-3.00"). */
export function formatDiopterTwoDecimals(value: number): string {
  return value.toFixed(2)
}

/** Build composite line SKU: `{familySku}_{sph}_{cyl}`. */
export function buildLineSku(
  familySku: string,
  sph: number,
  cyl: number,
): string {
  return `${familySku}_${formatDiopterTwoDecimals(sph)}_${formatDiopterTwoDecimals(cyl)}`
}

export function createEmptyOrderLine(
  overrides: Partial<OrderLine> = {},
): OrderLine {
  return {
    id: crypto.randomUUID(),
    productId: '',
    familySku: '',
    description: '',
    sph: 0,
    cyl: 0,
    qty: 1,
    unitPrice: 0,
    lineSku: '',
    ...overrides,
  }
}

/** True when order discount has percent and/or amount set. */
export function hasOrderDiscount(discount: DefaultDiscount): boolean {
  return (
    (discount.percent !== undefined && !Number.isNaN(discount.percent)) ||
    (discount.amountEur !== undefined && !Number.isNaN(discount.amountEur))
  )
}

/**
 * Effective order-level discount for the pool of lines without a line %.
 * Client default is only a seed into `orderDiscount` on client select — not a live fallback.
 */
export function resolveAppliedDiscount(
  orderDiscount: DefaultDiscount,
): DefaultDiscount {
  return { ...orderDiscount }
}

/** Applied line % when set and > 0; otherwise undefined (line joins pool). */
export function resolveLineDiscountPercent(
  line: OrderLine,
): number | undefined {
  const value = line.discountPercent
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

export function lineGross(line: OrderLine): number {
  const qty = Number.isFinite(line.qty) ? line.qty : 0
  const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0
  return qty * price
}

/**
 * Display/PDF line total after line % only (ignores order discount).
 * Prefer `computeLineNetContributions` for totals that include order pool discount.
 */
export function lineDisplayTotal(line: OrderLine): number {
  const gross = lineGross(line)
  const percent = resolveLineDiscountPercent(line)
  if (percent === undefined) return gross
  return Math.max(0, gross * (1 - percent / 100))
}

/** Apply order-style discount (% then €) to a gross pool amount. */
export function applyDiscountToAmount(
  gross: number,
  discount: DefaultDiscount,
): number {
  let afterPercent = gross
  if (
    discount.percent !== undefined &&
    !Number.isNaN(discount.percent)
  ) {
    afterPercent = gross * (1 - discount.percent / 100)
  }

  let discountFromAmount = 0
  if (
    discount.amountEur !== undefined &&
    !Number.isNaN(discount.amountEur)
  ) {
    discountFromAmount = discount.amountEur
  }

  return Math.max(0, afterPercent - discountFromAmount)
}

export type LineDiscountSource = 'line' | 'order' | 'none'

export interface LineNetContribution {
  line: OrderLine
  gross: number
  /** True when this line uses its own % and is excluded from the pool. */
  hasLineDiscount: boolean
  /**
   * Contribution to order subtotalNet. For line-% lines this is exact;
   * for pool lines this is their share of poolNet (proportional to pool gross).
   */
  net: number
  /** Discount euros on this line (gross − net). */
  discountAmount: number
  /** Where the effective discount comes from for display. */
  discountSource: LineDiscountSource
  /**
   * Percent to show on the line when applicable (line override, or
   * order % for pool lines). Undefined when only a € pool share applies.
   */
  displayPercent?: number
}

/**
 * Per-line nets: order discount is the default on every line without a
 * line %; line % overrides on specific lines. Sum of `net` equals
 * `computeOrderTotals(...).subtotalNet` (within floating point).
 */
export function computeLineNetContributions(
  lines: OrderLine[],
  orderDiscount: DefaultDiscount,
): LineNetContribution[] {
  const appliedDiscount = resolveAppliedDiscount(orderDiscount)

  const withMeta = lines.map((line) => {
    const gross = lineGross(line)
    const percent = resolveLineDiscountPercent(line)
    return { line, gross, percent }
  })

  let poolGross = 0
  for (const row of withMeta) {
    if (row.percent === undefined) poolGross += row.gross
  }

  const poolNet = applyDiscountToAmount(poolGross, appliedDiscount)
  const poolPercent =
    appliedDiscount.percent !== undefined &&
    !Number.isNaN(appliedDiscount.percent) &&
    appliedDiscount.percent > 0
      ? appliedDiscount.percent
      : undefined
  const orderHasDiscount = hasOrderDiscount(appliedDiscount)

  return withMeta.map(({ line, gross, percent }) => {
    if (percent !== undefined) {
      const net = Math.max(0, gross * (1 - percent / 100))
      return {
        line,
        gross,
        hasLineDiscount: true,
        net,
        discountAmount: Math.max(0, gross - net),
        discountSource: 'line' as const,
        displayPercent: percent,
      }
    }
    const net =
      poolGross <= 0 || gross <= 0 ? 0 : poolNet * (gross / poolGross)
    const discountAmount = Math.max(0, gross - net)
    return {
      line,
      gross,
      hasLineDiscount: false,
      net,
      discountAmount,
      discountSource: orderHasDiscount && discountAmount > 0 ? 'order' : 'none',
      ...(poolPercent !== undefined && discountAmount > 0
        ? { displayPercent: poolPercent }
        : {}),
    }
  })
}

/** Format the discount cell for UI/PDF (percent preferred, else € share). */
export function formatLineDiscountLabel(
  contribution: LineNetContribution,
  formatMoney: (n: number) => string,
): string {
  if (contribution.displayPercent !== undefined) {
    return `${contribution.displayPercent}%`
  }
  if (contribution.discountAmount > 0) {
    return formatMoney(contribution.discountAmount)
  }
  return '—'
}

export interface OrderTotals {
  pieces: number
  linesSubtotal: number
  discountAmount: number
  subtotalNet: number
  iva: number
  totalWithVat: number
  /** Order discount applied to the non-line-% pool (may be unused if pool empty). */
  appliedDiscount: DefaultDiscount
}

export function computeOrderTotals(
  lines: OrderLine[],
  orderDiscount: DefaultDiscount,
): OrderTotals {
  const appliedDiscount = resolveAppliedDiscount(orderDiscount)

  let pieces = 0
  let linesSubtotal = 0
  let lineDiscountNets = 0
  let poolGross = 0

  for (const line of lines) {
    const qty = Number.isFinite(line.qty) ? line.qty : 0
    const gross = lineGross(line)
    pieces += qty
    linesSubtotal += gross

    const percent = resolveLineDiscountPercent(line)
    if (percent !== undefined) {
      lineDiscountNets += Math.max(0, gross * (1 - percent / 100))
    } else {
      poolGross += gross
    }
  }

  const poolNet = applyDiscountToAmount(poolGross, appliedDiscount)
  const subtotalNet = lineDiscountNets + poolNet
  const discountAmount = Math.max(0, linesSubtotal - subtotalNet)
  const iva = subtotalNet * IVA_RATE
  const totalWithVat = subtotalNet + iva

  return {
    pieces,
    linesSubtotal,
    discountAmount,
    subtotalNet,
    iva,
    totalWithVat,
    appliedDiscount,
  }
}

export function canTransitionStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (from === to) return true
  if (from === 'Draft') return to === 'Confirmed' || to === 'Cancelled'
  if (from === 'Confirmed') return to === 'Completed' || to === 'Cancelled'
  return false
}

export function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** AAMM for August 2026 → "2608". */
export function yearMonthKey(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${yy}${mm}`
}
