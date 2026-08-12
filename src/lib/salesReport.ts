import {
  IVA_RATE,
  buildLineSku,
  computeLineNetContributions,
  type Order,
  type OrderLine,
} from '../types/order'

export interface SkuSalesRow {
  lineSku: string
  qty: number
  /** Net amount after effective per-line discounts, excluding VAT. */
  amountNet: number
  /** Net amount after effective per-line discounts, including VAT. */
  amountWithVat: number
}

const SALES_STATUSES = new Set(['Confirmed', 'Completed'])

/** YYYY-MM-DD calendar day from ISO confirmation timestamp. */
export function confirmationDateKey(
  confirmedAt: string | undefined,
): string | null {
  if (!confirmedAt) return null
  const day = confirmedAt.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function isConfirmationDateInRange(
  confirmedAt: string | undefined,
  dateFrom: string,
  dateTo: string,
): boolean {
  const day = confirmationDateKey(confirmedAt)
  if (!day) return false
  if (dateFrom && day < dateFrom) return false
  if (dateTo && day > dateTo) return false
  return true
}

/** Persisted `lineSku`, or reconstruct via shared formatter; null if unresolvable. */
export function resolveLineSku(line: OrderLine): string | null {
  const stored = line.lineSku?.trim()
  if (stored) return stored
  const familySku = line.familySku?.trim()
  if (!familySku) return null
  return buildLineSku(familySku, line.sph, line.cyl)
}

/**
 * Filter Confirmed/Completed orders by inclusive confirmation-date range.
 * Excludes Draft, Cancelled, and orders without confirmedAt.
 */
export function filterOrdersForSalesReport(
  orders: Order[],
  dateFrom: string,
  dateTo: string,
): Order[] {
  return orders.filter((order) => {
    if (!SALES_STATUSES.has(order.status)) return false
    return isConfirmationDateInRange(order.confirmedAt, dateFrom, dateTo)
  })
}

/**
 * Allocate pool net to a pool line in proportion to its gross within the pool.
 * Prefer `computeLineNetContributions` for full order allocation (line % + pool).
 */
export function allocateLineNet(
  lineGross: number,
  linesSubtotal: number,
  orderSubtotalNet: number,
): number {
  if (linesSubtotal <= 0 || lineGross <= 0) return 0
  return orderSubtotalNet * (lineGross / linesSubtotal)
}

/** Group by lineSku; sum qty and sold amounts (effective per-line nets). */
export function aggregateSalesBySku(orders: Order[]): SkuSalesRow[] {
  const totals = new Map<
    string,
    { qty: number; amountNet: number; amountWithVat: number }
  >()

  for (const order of orders) {
    if (!SALES_STATUSES.has(order.status)) continue
    if (!order.confirmedAt) continue

    const contributions = computeLineNetContributions(
      order.lines,
      order.orderDiscount,
    )

    for (const { line, net: amountNet } of contributions) {
      const lineSku = resolveLineSku(line)
      if (!lineSku) continue
      const qty = Number.isFinite(line.qty) ? line.qty : 0
      const amountWithVat = amountNet * (1 + IVA_RATE)
      const prev = totals.get(lineSku) ?? {
        qty: 0,
        amountNet: 0,
        amountWithVat: 0,
      }
      totals.set(lineSku, {
        qty: prev.qty + qty,
        amountNet: prev.amountNet + amountNet,
        amountWithVat: prev.amountWithVat + amountWithVat,
      })
    }
  }

  return [...totals.entries()]
    .map(([lineSku, values]) => ({ lineSku, ...values }))
    .sort((a, b) => b.qty - a.qty || a.lineSku.localeCompare(b.lineSku))
}

export function buildSalesReport(
  orders: Order[],
  dateFrom: string,
  dateTo: string,
): SkuSalesRow[] {
  return aggregateSalesBySku(
    filterOrdersForSalesReport(orders, dateFrom, dateTo),
  )
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCsvNumber(value: number): string {
  return value.toFixed(2)
}

/** CSV matching on-screen columns. */
export function salesRowsToCsv(rows: SkuSalesRow[]): string {
  const lines = ['SKU,quantity,amount_ex_vat,amount_inc_vat']
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.lineSku),
        row.qty,
        formatCsvNumber(row.amountNet),
        formatCsvNumber(row.amountWithVat),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function downloadSalesCsv(
  rows: SkuSalesRow[],
  filename: string,
): void {
  const blob = new Blob([salesRowsToCsv(rows)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Default report range: first day of current month → today (YYYY-MM-DD). */
export function defaultSalesReportRange(now = new Date()): {
  dateFrom: string
  dateTo: string
} {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    dateFrom: `${y}-${m}-01`,
    dateTo: `${y}-${m}-${d}`,
  }
}
