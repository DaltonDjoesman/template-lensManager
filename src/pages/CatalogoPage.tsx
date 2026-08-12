import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Button } from '../components/ui/Button'
import { IconPlus, IconSearch } from '../components/icons'
import {
  deleteProduct,
  formatAmplitudeRange,
  formatEur,
  listProducts,
  productMatchesSearch,
  seedReferenceProducts,
} from '../lib/products'
import type { Product } from '../types/product'
import '../components/ui/Card.css'

export function CatalogoPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  async function loadProducts() {
    setLoading(true)
    setError(null)
    try {
      const data = await listProducts()
      setProducts(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load the catalog.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  const filtered = useMemo(
    () => products.filter((p) => productMatchesSearch(p, search)),
    [products, search],
  )

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${product.sku}" from the catalog?`,
    )
    if (!confirmed) return

    setDeletingId(product.id)
    setError(null)
    try {
      await deleteProduct(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setToast('Lens SKU removed from the catalog.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete the product.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSeed() {
    if (products.length > 0) {
      const confirmed = window.confirm(
        'This will replace all catalog products with the 8 fictional demo families. Continue?',
      )
      if (!confirmed) return
    }

    setSeeding(true)
    setError(null)
    try {
      const created = await seedReferenceProducts()
      await loadProducts()
      setToast(`${created} demo catalog families loaded.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load demo catalog.',
      )
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="sub-view">
      <ViewHeader
        title="Lens Catalog"
        subtitle="Parameterized ophthalmic lens ranges and SPH/CYL amplitudes."
        actions={
          <Button
            variant="accent"
            type="button"
            onClick={() => navigate('/catalogo/novo')}
          >
            <IconPlus />
            Add Lens SKU
          </Button>
        }
      />

      <div className="filters-bar">
        <div className="search-input-wrapper">
          <IconSearch className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by SKU or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search catalog by SKU or description"
          />
        </div>
        {products.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={seeding || loading}
            onClick={() => void handleSeed()}
          >
            {seeding ? 'Loading…' : 'Restore demo catalog'}
          </Button>
        ) : null}
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
              <th>Lens SKU</th>
              <th>Range / Description</th>
              <th>Base Unit Price</th>
              <th>Spherical Range (SPH)</th>
              <th>Cylindrical Range (CYL)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  Loading catalog…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  <div className="catalog-empty">
                    <p>
                      {search.trim()
                        ? 'No products match the search.'
                        : 'No SKUs in the catalog yet.'}
                    </p>
                    {!search.trim() ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={seeding}
                        onClick={() => void handleSeed()}
                      >
                        {seeding ? 'Loading…' : 'Load demo catalog'}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <span className="mono">{product.sku}</span>
                  </td>
                  <td>
                    <strong>{product.description}</strong>
                  </td>
                  <td className="mono">{formatEur(product.unitPrice)}</td>
                  <td className="mono">
                    {formatAmplitudeRange(product.sphMin, product.sphMax)}
                  </td>
                  <td className="mono">
                    {formatAmplitudeRange(product.cylMin, product.cylMax)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <Link
                        to={`/catalogo/${product.id}`}
                        className="btn btn--secondary btn--sm"
                      >
                        Edit
                      </Link>
                      <Button
                        type="button"
                        variant="danger"
                        className="btn--sm"
                        disabled={deletingId === product.id}
                        onClick={() => void handleDelete(product)}
                      >
                        {deletingId === product.id ? '…' : 'Delete'}
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
