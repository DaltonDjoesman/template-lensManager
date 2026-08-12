import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Button } from '../components/ui/Button'
import { IconMoreHorizontal, IconPlus, IconSearch } from '../components/icons'
import { listClients } from '../lib/clients'
import {
  deleteOrder,
  duplicateOrder,
  filterOrders,
  formatEur,
  formatOrderDate,
  listOrders,
  orderNetTotal,
  orderPieces,
} from '../lib/orders'
import type { Client } from '../types/client'
import {
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
} from '../types/order'
import '../components/ui/Card.css'

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'Draft':
      return 'badge badge-draft'
    case 'Confirmed':
      return 'badge badge-confirmed'
    case 'Completed':
      return 'badge badge-completed'
    case 'Cancelled':
      return 'badge badge-cancelled'
  }
}

function isCurrentMonth(isoDate: string): boolean {
  if (!isoDate) return false
  const now = new Date()
  const [y, m] = isoDate.split('-')
  return (
    Number(y) === now.getFullYear() && Number(m) === now.getMonth() + 1
  )
}

export function PedidosPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [clientId, setClientId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  )
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null)

  function openRowMenu(orderId: string, trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    })
    setMenuOpenId(orderId)
  }

  function closeRowMenu() {
    setMenuOpenId(null)
    setMenuPos(null)
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [orderData, clientData] = await Promise.all([
        listOrders(),
        listClients(),
      ])
      setOrders(orderData)
      setClients(clientData)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load orders.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!menuOpenId) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      if (menuTriggerRef.current?.contains(target)) return
      closeRowMenu()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRowMenu()
    }

    function onRepositionClose() {
      closeRowMenu()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onRepositionClose)
    window.addEventListener('scroll', onRepositionClose, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onRepositionClose)
      window.removeEventListener('scroll', onRepositionClose, true)
    }
  }, [menuOpenId])

  const filtered = useMemo(
    () =>
      filterOrders(orders, {
        search,
        status,
        clientId,
        dateFrom,
        dateTo,
      }),
    [orders, search, status, clientId, dateFrom, dateTo],
  )

  const metrics = useMemo(() => {
    const confirmedThisMonth = orders.filter(
      (o) => o.status === 'Confirmed' && isCurrentMonth(o.orderDate),
    ).length
    const drafts = orders.filter((o) => o.status === 'Draft').length
    const volume = orders
      .filter((o) => o.status === 'Confirmed' || o.status === 'Completed')
      .reduce((sum, o) => sum + orderNetTotal(o), 0)
    const lenses = orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + orderPieces(o), 0)
    return { confirmedThisMonth, drafts, volume, lenses }
  }, [orders])

  function resetFilters() {
    setSearch('')
    setStatus('')
    setClientId('')
    setDateFrom('')
    setDateTo('')
  }

  async function handleDuplicate(order: Order) {
    closeRowMenu()
    setDuplicatingId(order.id)
    setError(null)
    try {
      const newId = await duplicateOrder(order.id)
      setToast('Order duplicated as draft.')
      navigate(`/pedidos/${newId}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not duplicate the order.',
      )
    } finally {
      setDuplicatingId(null)
    }
  }

  async function handleDelete(order: Order) {
    closeRowMenu()
    if (order.status !== 'Draft') return

    const label = order.clientName || 'no client'
    const confirmed = window.confirm(
      `Delete the draft for "${label}"? This action cannot be undone.`,
    )
    if (!confirmed) return

    setDeletingId(order.id)
    setError(null)
    try {
      await deleteOrder(order.id)
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      setToast('Draft deleted.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete the order.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  const busyId = duplicatingId ?? deletingId
  const menuOrder =
    menuOpenId != null
      ? (filtered.find((o) => o.id === menuOpenId) ?? null)
      : null

  return (
    <div className="sub-view">
      <ViewHeader
        title="Orders"
        subtitle="Manage drafts, confirm orders, and issue proformas."
        actions={
          <Button
            variant="accent"
            type="button"
            onClick={() => navigate('/pedidos/novo')}
          >
            <IconPlus />
            New Order
          </Button>
        }
      />

      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Confirmed Orders (Month)</span>
          <span className="metric-value">{metrics.confirmedThisMonth}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Drafts in Progress</span>
          <span className="metric-value">{metrics.drafts}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Billing Volume (€)</span>
          <span className="metric-value mono">
            {formatEur(metrics.volume)}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Lenses Requested</span>
          <span className="metric-value mono">{metrics.lenses}</span>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <IconSearch className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by no., tax ID, PO, or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search orders"
          />
        </div>

        <select
          className="filter-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | '')}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          aria-label="Filter by client"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.billing.name}
            </option>
          ))}
        </select>

        <div className="filter-date-group">
          <span>From</span>
          <input
            type="date"
            className="filter-date-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Start date"
          />
          <span>To</span>
          <input
            type="date"
            className="filter-date-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="End date"
          />
        </div>

        <Button type="button" variant="secondary" onClick={resetFilters}>
          Clear
        </Button>
      </div>

      {error ? (
        <div className="login-error login-error--visible" role="alert">
          {error}
        </div>
      ) : null}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Document No.</th>
              <th>Client (Optician)</th>
              <th>Client PO Ref.</th>
              <th>Order Date</th>
              <th>Net Total</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  Loading orders…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">
                  {orders.length === 0
                    ? 'No orders yet. Create the first draft.'
                    : 'No orders match the filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="mono">
                      {order.pedNumber ?? 'Draft'}
                    </span>
                  </td>
                  <td>
                    <strong>{order.clientName || '—'}</strong>
                    {order.clientNif ? (
                      <div className="table-secondary mono">
                        {order.clientNif}
                      </div>
                    ) : null}
                  </td>
                  <td className="mono">{order.clientPo || '—'}</td>
                  <td>{formatOrderDate(order.orderDate)}</td>
                  <td className="mono">{formatEur(orderNetTotal(order))}</td>
                  <td>
                    <span className={statusBadgeClass(order.status)}>
                      {order.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <Link
                        to={`/pedidos/${order.id}`}
                        className="btn btn--secondary btn--sm"
                      >
                        Open
                      </Link>
                      <div className="row-menu">
                        <Button
                          ref={
                            menuOpenId === order.id ? menuTriggerRef : undefined
                          }
                          type="button"
                          variant="secondary"
                          className="btn--sm btn--icon"
                          aria-label="More actions"
                          aria-haspopup="menu"
                          aria-expanded={menuOpenId === order.id}
                          disabled={busyId === order.id}
                          onClick={(e) => {
                            if (menuOpenId === order.id) {
                              closeRowMenu()
                              return
                            }
                            openRowMenu(order.id, e.currentTarget)
                          }}
                        >
                          {busyId === order.id ? '…' : <IconMoreHorizontal />}
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {menuOrder && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="row-menu-dropdown row-menu-dropdown--portal"
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                type="button"
                role="menuitem"
                className="row-menu-item"
                onClick={() => void handleDuplicate(menuOrder)}
              >
                Duplicate
              </button>
              {menuOrder.status === 'Draft' ? (
                <button
                  type="button"
                  role="menuitem"
                  className="row-menu-item row-menu-item--danger"
                  onClick={() => void handleDelete(menuOrder)}
                >
                  Delete
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
