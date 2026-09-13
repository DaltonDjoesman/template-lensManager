import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Button } from '../components/ui/Button'
import { IconPlus, IconSearch } from '../components/icons'
import {
  clientMatchesSearch,
  deleteClient,
  formatDefaultDiscount,
  formatPaymentTerms,
  listClients,
} from '../lib/clients'
import type { Client } from '../types/client'
import '../components/ui/Card.css'

export function ClientesPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadClients() {
    setLoading(true)
    setError(null)
    try {
      const data = await listClients()
      setClients(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load clients.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadClients()
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtered = useMemo(
    () => clients.filter((c) => clientMatchesSearch(c, search)),
    [clients, search],
  )

  async function handleDelete(client: Client) {
    const confirmed = window.confirm(
      `Remove "${client.billing.name}" from the system?`,
    )
    if (!confirmed) return

    setDeletingId(client.id)
    setError(null)
    try {
      await deleteClient(client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
      setToast('Client removed.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete the client.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="sub-view">
      <ViewHeader
        title="Client Records"
        subtitle="Partner opticians and agreed discounts."
        actions={
          <Button
            variant="accent"
            type="button"
            onClick={() => navigate('/clientes/novo')}
          >
            <IconPlus />
            Add Client
          </Button>
        }
      />

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <IconSearch className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by name or tax ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients by name or tax ID"
          />
        </div>
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
              <th>Tax ID</th>
              <th>Optician Name</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Base Discount</th>
              <th>Payment</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  Loading clients…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  {search.trim()
                    ? 'No clients match the search.'
                    : 'No clients yet. Add the first optician.'}
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
                <tr key={client.id}>
                  <td>
                    <span className="mono">{client.billing.nif}</span>
                  </td>
                  <td>
                    <strong>{client.billing.name}</strong>
                  </td>
                  <td>{client.billing.contactName || '—'}</td>
                  <td>{client.billing.email || '—'}</td>
                  <td className="mono">{client.billing.phone || '—'}</td>
                  <td>
                    <span className="discount-badge-info">
                      {formatDefaultDiscount(client.defaultDiscount)}
                    </span>
                  </td>
                  <td>
                    <span className="discount-badge-info">
                      {formatPaymentTerms(client.paymentTerms)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <Link
                        to={`/clientes/${client.id}`}
                        className="btn btn--secondary btn--sm"
                      >
                        Edit
                      </Link>
                      <Button
                        type="button"
                        variant="danger"
                        className="btn--sm"
                        disabled={deletingId === client.id}
                        onClick={() => void handleDelete(client)}
                      >
                        {deletingId === client.id ? '…' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
