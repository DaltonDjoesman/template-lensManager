import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import {
  DuplicateSkuError,
  createProduct,
  getProduct,
  updateProduct,
} from '../lib/products'
import type { ProductInput } from '../types/product'
import '../components/ui/Card.css'

type FieldErrors = Partial<
  Record<
    | 'sku'
    | 'description'
    | 'unitPrice'
    | 'sphMin'
    | 'sphMax'
    | 'cylMin'
    | 'cylMax',
    string
  >
>

type AmplitudeDraft = {
  sphMin: string
  sphMax: string
  cylMin: string
  cylMax: string
  unitPrice: string
}

function parseRequiredNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (Number.isNaN(value)) return null
  return value
}

function validateProduct(
  sku: string,
  description: string,
  draft: AmplitudeDraft,
): { errors: FieldErrors; input: ProductInput | null } {
  const errors: FieldErrors = {}

  if (!sku.trim()) {
    errors.sku = 'SKU code is required.'
  }
  if (!description.trim()) {
    errors.description = 'Description/range is required.'
  }

  const unitPrice = parseRequiredNumber(draft.unitPrice)
  if (unitPrice === null) {
    errors.unitPrice = 'Unit price is required.'
  } else if (unitPrice <= 0) {
    errors.unitPrice = 'Unit price must be greater than zero.'
  }

  const sphMin = parseRequiredNumber(draft.sphMin)
  const sphMax = parseRequiredNumber(draft.sphMax)
  const cylMin = parseRequiredNumber(draft.cylMin)
  const cylMax = parseRequiredNumber(draft.cylMax)

  if (sphMin === null) {
    errors.sphMin = 'Minimum SPH is required.'
  }
  if (sphMax === null) {
    errors.sphMax = 'Maximum SPH is required.'
  }
  if (cylMin === null) {
    errors.cylMin = 'Minimum CYL is required.'
  }
  if (cylMax === null) {
    errors.cylMax = 'Maximum CYL is required.'
  }

  if (sphMin !== null && sphMax !== null && sphMin > sphMax) {
    errors.sphMin = 'Minimum SPH cannot exceed maximum.'
    errors.sphMax = 'Maximum SPH cannot be less than minimum.'
  }

  if (cylMin !== null && cylMax !== null && cylMin > cylMax) {
    errors.cylMin = 'Minimum CYL cannot exceed maximum.'
    errors.cylMax = 'Maximum CYL cannot be less than minimum.'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, input: null }
  }

  return {
    errors,
    input: {
      sku: sku.trim(),
      description: description.trim(),
      unitPrice: unitPrice!,
      sphMin: sphMin!,
      sphMax: sphMax!,
      cylMin: cylMin!,
      cylMax: cylMax!,
    },
  }
}

export function CatalogoFormPage() {
  const { id } = useParams<{ id: string }>()
  const isCreate = !id
  const navigate = useNavigate()
  const location = useLocation()

  const [sku, setSku] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<AmplitudeDraft>({
    sphMin: '',
    sphMax: '',
    cylMin: '',
    cylMax: '',
    unitPrice: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(!isCreate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { saved?: boolean } | null
    if (state?.saved) {
      setToast('Lens properties saved to the catalog.')
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  useEffect(() => {
    if (isCreate || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const product = await getProduct(id)
        if (cancelled) return
        if (!product) {
          setError('Product not found.')
          return
        }
        setSku(product.sku)
        setDescription(product.description)
        setDraft({
          unitPrice: String(product.unitPrice),
          sphMin: String(product.sphMin),
          sphMax: String(product.sphMax),
          cylMin: String(product.cylMin),
          cylMax: String(product.cylMax),
        })
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the product.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, isCreate])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  function updateDraft<K extends keyof AmplitudeDraft>(
    key: K,
    value: AmplitudeDraft[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const { errors, input } = validateProduct(sku, description, draft)
    setFieldErrors(errors)
    if (!input) {
      setError('Fix the highlighted fields before saving.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (isCreate) {
        const newId = await createProduct(input)
        navigate(`/catalogo/${newId}`, {
          replace: true,
          state: { saved: true },
        })
        return
      }
      if (id) {
        await updateProduct(id, input)
        setToast('Lens properties saved to the catalog.')
      }
    } catch (err) {
      if (err instanceof DuplicateSkuError) {
        setFieldErrors((prev) => ({
          ...prev,
          sku: 'This SKU code already exists in the catalog.',
        }))
        setError('This SKU code already exists in the catalog.')
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save the product.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const title = isCreate
    ? 'Configure New Lens'
    : sku
      ? `Edit Lens — ${sku}`
      : 'Edit Lens'

  return (
    <div className="sub-view">
      <ViewHeader
        title={title}
        subtitle="Define product properties and production amplitude limits."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/catalogo')}
          >
            Back
          </Button>
        }
      />

      <Card
        title="Properties and Manufacturing Amplitudes"
        className="client-form-card"
      >
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading product…</p>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="settings-form"
            noValidate
          >
            {error ? (
              <div className="login-error login-error--visible" role="alert">
                {error}
              </div>
            ) : null}

            <div className="grid-2col">
              <Input
                id="catalog-sku"
                label="Unique SKU Code *"
                placeholder="e.g. MID Clear 1.50"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                error={fieldErrors.sku}
                disabled={!isCreate}
                autoComplete="off"
              />
              <Input
                id="catalog-description"
                label="Range / Commercial Description *"
                placeholder="e.g. MID Clear 1.50"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={fieldErrors.description}
              />
            </div>

            <div className="grid-2col">
              <Input
                id="catalog-price"
                label="Base Unit Price (€) *"
                type="number"
                step="0.01"
                min={0}
                placeholder="e.g. 45.00"
                value={draft.unitPrice}
                onChange={(e) => updateDraft('unitPrice', e.target.value)}
                error={fieldErrors.unitPrice}
              />
            </div>

            <div className="amplitude-block grid-2col">
              <div className="amplitude-group">
                <span className="amplitude-label">Spherical Amplitude (SPH)</span>
                <div className="amplitude-inputs">
                  <Input
                    id="catalog-sph-min"
                    label="Minimum *"
                    type="number"
                    step="0.25"
                    placeholder="e.g. -6.00"
                    value={draft.sphMin}
                    onChange={(e) => updateDraft('sphMin', e.target.value)}
                    error={fieldErrors.sphMin}
                  />
                  <span className="amplitude-separator" aria-hidden="true">
                    to
                  </span>
                  <Input
                    id="catalog-sph-max"
                    label="Maximum *"
                    type="number"
                    step="0.25"
                    placeholder="e.g. 4.00"
                    value={draft.sphMax}
                    onChange={(e) => updateDraft('sphMax', e.target.value)}
                    error={fieldErrors.sphMax}
                  />
                </div>
              </div>

              <div className="amplitude-group">
                <span className="amplitude-label">
                  Cylindrical Amplitude (CYL)
                </span>
                <div className="amplitude-inputs">
                  <Input
                    id="catalog-cyl-min"
                    label="Minimum *"
                    type="number"
                    step="0.25"
                    placeholder="e.g. -2.00"
                    value={draft.cylMin}
                    onChange={(e) => updateDraft('cylMin', e.target.value)}
                    error={fieldErrors.cylMin}
                  />
                  <span className="amplitude-separator" aria-hidden="true">
                    to
                  </span>
                  <Input
                    id="catalog-cyl-max"
                    label="Maximum *"
                    type="number"
                    step="0.25"
                    placeholder="e.g. 2.00"
                    value={draft.cylMax}
                    onChange={(e) => updateDraft('cylMax', e.target.value)}
                    error={fieldErrors.cylMax}
                  />
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/catalogo')}
              >
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={saving}>
                {saving ? 'Saving…' : 'Save SKU to Catalog'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
