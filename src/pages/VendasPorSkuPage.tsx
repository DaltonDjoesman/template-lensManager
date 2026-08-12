import { useEffect, useState } from 'react'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Button } from '../components/ui/Button'
import { formatEur, listSoldOrdersInConfirmationRange } from '../lib/orders'
import {
  aggregateSalesBySku,
  defaultSalesReportRange,
  downloadSalesCsv,
  type SkuSalesRow,
} from '../lib/salesReport'

export function VendasPorSkuPage() {
  const [dateFrom, setDateFrom] = useState(
    () => defaultSalesReportRange().dateFrom,
  )
  const [dateTo, setDateTo] = useState(() => defaultSalesReportRange().dateTo)
  const [rows, setRows] = useState<SkuSalesRow[]>([])
  const [hasRun, setHasRun] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function runReport(from: string, to: string) {
    if (!from || !to) {
      setError('Select a start date and an end date.')
      setLoading(false)
      return
    }
    if (from > to) {
      setError('The start date cannot be after the end date.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const orders = await listSoldOrdersInConfirmationRange(from, to)
      setRows(aggregateSalesBySku(orders))
      setHasRun(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not generate the sales report.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const range = defaultSalesReportRange()
    void runReport(range.dateFrom, range.dateTo)
  }, [])

  function handleExport() {
    if (rows.length === 0) return
    const filename = `vendas-por-sku_${dateFrom}_${dateTo}.csv`
    downloadSalesCsv(rows, filename)
  }

  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const totalNet = rows.reduce((sum, row) => sum + row.amountNet, 0)
  const totalWithVat = rows.reduce((sum, row) => sum + row.amountWithVat, 0)

  return (
    <div className="sub-view">
      <ViewHeader
        title="Sales by SKU"
        subtitle="Quantities and amounts sold by composite SKU (Confirmed and Completed), with order discount applied."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={handleExport}
            disabled={loading || rows.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <div className="filters-bar">
        <div className="filter-date-group">
          <span>From</span>
          <input
            type="date"
            className="filter-date-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Confirmation start date"
          />
          <span>To</span>
          <input
            type="date"
            className="filter-date-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Confirmation end date"
          />
        </div>

        <Button
          type="button"
          variant="accent"
          onClick={() => void runReport(dateFrom, dateTo)}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <div className="login-error login-error--visible" role="alert">
          {error}
        </div>
      ) : null}

      {hasRun && !loading && rows.length > 0 ? (
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Distinct SKUs</span>
            <span className="metric-value mono">{rows.length}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total lenses</span>
            <span className="metric-value mono">{totalQty}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total excl. VAT</span>
            <span className="metric-value mono">{formatEur(totalNet)}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Total incl. VAT</span>
            <span className="metric-value mono">{formatEur(totalWithVat)}</span>
          </div>
        </div>
      ) : null}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th style={{ textAlign: 'center' }}>Quantity</th>
              <th style={{ textAlign: 'center' }}>Amount excl. VAT</th>
              <th style={{ textAlign: 'center' }}>Amount incl. VAT</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  Loading sales…
                </td>
              </tr>
            ) : !hasRun ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  Select a date range and refresh the report.
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  No Confirmed or Completed sales in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.lineSku}>
                  <td className="mono">{row.lineSku}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>
                    {row.qty}
                  </td>
                  <td className="mono" style={{ textAlign: 'center' }}>
                    {formatEur(row.amountNet)}
                  </td>
                  <td className="mono" style={{ textAlign: 'center' }}>
                    {formatEur(row.amountWithVat)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
