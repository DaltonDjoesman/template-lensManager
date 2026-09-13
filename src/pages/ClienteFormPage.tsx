import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Card } from '../components/ui/Card'
import { Input, TextArea } from '../components/ui/Input'
import { PostalCodeInput } from '../components/ui/PostalCodeInput'
import { Button } from '../components/ui/Button'
import {
  DuplicateNifError,
  createClient,
  getClient,
  normalizePrimaryLocations,
  updateClient,
} from '../lib/clients'
import {
  createDeliveryLocation,
  emptyClientInput,
  type ClientBilling,
  type ClientDeliveryLocation,
  type ClientInput,
  type DefaultDiscount,
  type PaymentTerms,
} from '../types/client'
import '../components/ui/Card.css'

type BillingFieldErrors = Partial<
  Record<'name' | 'nif' | 'contactName' | 'address' | 'phone' | 'email', string>
>

type LocationFieldErrors = Partial<Record<'label', string>>

function validateBilling(billing: ClientBilling): BillingFieldErrors {
  const errors: BillingFieldErrors = {}
  if (!billing.name.trim()) {
    errors.name = 'Optician name is required.'
  }
  if (!billing.nif.trim()) {
    errors.nif = 'Tax ID is required.'
  }
  if (!billing.contactName.trim()) {
    errors.contactName = 'Contact name is required.'
  }
  if (!billing.address.trim()) {
    errors.address = 'Billing address is required.'
  }
  return errors
}

function validateLocations(
  locations: ClientDeliveryLocation[],
): Record<string, LocationFieldErrors> {
  const errors: Record<string, LocationFieldErrors> = {}
  for (const loc of locations) {
    if (!loc.label.trim()) {
      errors[loc.id] = {
        label: 'Delivery location label is required.',
      }
    }
  }
  return errors
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const value = Number(trimmed)
  if (Number.isNaN(value)) return undefined
  return value
}

export function ClienteFormPage() {
  const { id } = useParams<{ id: string }>()
  const isCreate = !id
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState<ClientInput>(emptyClientInput)
  const [percentInput, setPercentInput] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [fieldErrors, setFieldErrors] = useState<BillingFieldErrors>({})
  const [locationErrors, setLocationErrors] = useState<
    Record<string, LocationFieldErrors>
  >({})
  const [loading, setLoading] = useState(!isCreate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { saved?: boolean } | null
    if (state?.saved) {
      setToast('Client record saved.')
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
        const client = await getClient(id)
        if (cancelled) return
        if (!client) {
          setError('Client not found.')
          return
        }
        setForm({
          billing: { ...client.billing },
          deliveryLocations: client.deliveryLocations.map((loc) => ({
            ...loc,
          })),
          defaultDiscount: { ...client.defaultDiscount },
          paymentTerms: client.paymentTerms,
        })
        setPercentInput(
          client.defaultDiscount.percent !== undefined
            ? String(client.defaultDiscount.percent)
            : '',
        )
        setAmountInput(
          client.defaultDiscount.amountEur !== undefined
            ? String(client.defaultDiscount.amountEur)
            : '',
        )
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the client.',
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

  function updateBilling<K extends keyof ClientBilling>(
    key: K,
    value: ClientBilling[K],
  ) {
    setForm((prev) => ({
      ...prev,
      billing: { ...prev.billing, [key]: value },
    }))
  }

  function updateLocation<K extends keyof ClientDeliveryLocation>(
    locationId: string,
    key: K,
    value: ClientDeliveryLocation[K],
  ) {
    setForm((prev) => ({
      ...prev,
      deliveryLocations: prev.deliveryLocations.map((loc) =>
        loc.id === locationId ? { ...loc, [key]: value } : loc,
      ),
    }))
  }

  function addLocation() {
    setForm((prev) => {
      const next = createDeliveryLocation({
        isPrimary: prev.deliveryLocations.length === 0,
      })
      return {
        ...prev,
        deliveryLocations: [...prev.deliveryLocations, next],
      }
    })
  }

  function removeLocation(locationId: string) {
    setForm((prev) => {
      const remaining = prev.deliveryLocations.filter(
        (loc) => loc.id !== locationId,
      )
      return {
        ...prev,
        deliveryLocations: normalizePrimaryLocations(remaining),
      }
    })
    setLocationErrors((prev) => {
      const next = { ...prev }
      delete next[locationId]
      return next
    })
  }

  function setPrimaryLocation(locationId: string) {
    setForm((prev) => ({
      ...prev,
      deliveryLocations: prev.deliveryLocations.map((loc) => ({
        ...loc,
        isPrimary: loc.id === locationId,
      })),
    }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const billingErrors = validateBilling(form.billing)
    const locErrors = validateLocations(form.deliveryLocations)
    setFieldErrors(billingErrors)
    setLocationErrors(locErrors)
    if (
      Object.keys(billingErrors).length > 0 ||
      Object.keys(locErrors).length > 0
    ) {
      setError('Fix required fields before saving.')
      return
    }

    const defaultDiscount: DefaultDiscount = {}
    const percent = parseOptionalNumber(percentInput)
    const amountEur = parseOptionalNumber(amountInput)
    if (percent !== undefined) defaultDiscount.percent = percent
    if (amountEur !== undefined) defaultDiscount.amountEur = amountEur

    const payload: ClientInput = {
      billing: { ...form.billing },
      deliveryLocations: normalizePrimaryLocations(
        form.deliveryLocations.map((loc) => ({ ...loc })),
      ),
      defaultDiscount,
      paymentTerms: form.paymentTerms,
    }

    setSaving(true)
    setError(null)
    try {
      if (isCreate) {
        const newId = await createClient(payload)
        navigate(`/clientes/${newId}`, {
          replace: true,
          state: { saved: true },
        })
        return
      }
      if (id) {
        await updateClient(id, payload)
        const saved = await getClient(id)
        if (saved) {
          setForm({
            billing: { ...saved.billing },
            deliveryLocations: saved.deliveryLocations.map((loc) => ({
              ...loc,
            })),
            defaultDiscount: { ...saved.defaultDiscount },
            paymentTerms: saved.paymentTerms,
          })
          setPercentInput(
            saved.defaultDiscount.percent !== undefined
              ? String(saved.defaultDiscount.percent)
              : '',
          )
          setAmountInput(
            saved.defaultDiscount.amountEur !== undefined
              ? String(saved.defaultDiscount.amountEur)
              : '',
          )
        }
        setToast('Client record saved.')
      }
    } catch (err) {
      setError(
        err instanceof DuplicateNifError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not save the client.',
      )
    } finally {
      setSaving(false)
    }
  }

  const title = isCreate
    ? 'Add New Client'
    : form.billing.name
      ? `Edit Client — ${form.billing.name}`
      : 'Edit Client'

  return (
    <div className="sub-view">
      <ViewHeader
        title={title}
        subtitle="Enter tax details and delivery addresses."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/clientes')}
          >
            Back
          </Button>
        }
      />

      <Card title="Optician Registration Record" className="client-form-card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading client…</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="settings-form" noValidate>
            {error ? (
              <div className="login-error login-error--visible" role="alert">
                {error}
              </div>
            ) : null}

            <div className="form-section-label all-caps">Billing</div>

            <div className="grid-2col">
              <Input
                id="client-name"
                label="Optician Name *"
                placeholder="e.g. Central Opticians Leiria"
                value={form.billing.name}
                onChange={(e) => updateBilling('name', e.target.value)}
                error={fieldErrors.name}
              />
              <Input
                id="client-nif"
                label="Tax ID *"
                placeholder="e.g. 501234567"
                value={form.billing.nif}
                onChange={(e) => updateBilling('nif', e.target.value)}
                error={fieldErrors.nif}
              />
            </div>

            <div className="grid-2col">
              <Input
                id="client-contact-name"
                label="Contact Name *"
                placeholder="e.g. Ana Silva"
                value={form.billing.contactName}
                onChange={(e) => updateBilling('contactName', e.target.value)}
                error={fieldErrors.contactName}
              />
              <Input
                id="client-phone"
                label="Phone"
                type="tel"
                placeholder="e.g. 244100200"
                value={form.billing.phone}
                onChange={(e) => updateBilling('phone', e.target.value)}
                error={fieldErrors.phone}
              />
            </div>

            <Input
              id="client-email"
              label="Email Address"
              type="email"
              placeholder="e.g. orders@optica.example"
              value={form.billing.email}
              onChange={(e) => updateBilling('email', e.target.value)}
              error={fieldErrors.email}
            />

            <TextArea
              id="client-billing-address"
              label="Full Billing Address *"
              placeholder="Street, number, postal code, city"
              rows={3}
              value={form.billing.address}
              onChange={(e) => updateBilling('address', e.target.value)}
              error={fieldErrors.address}
            />

            <div className="form-section-label all-caps">
              Delivery (Ship To)
            </div>
            <p className="form-section-hint">
              Add one or more delivery locations. The primary location is the
              default when creating orders.
            </p>

            <div className="delivery-locations">
              {form.deliveryLocations.length === 0 ? (
                <p className="delivery-locations-empty">
                  No delivery locations yet. Add one if the destination differs
                  from billing.
                </p>
              ) : null}

              {form.deliveryLocations.map((loc, index) => (
                <div key={loc.id} className="delivery-location">
                  <div className="delivery-location-header">
                    <span className="delivery-location-title all-caps">
                      Location {index + 1}
                      {loc.isPrimary ? ' · Primary' : ''}
                    </span>
                    <div className="delivery-location-actions">
                      {!loc.isPrimary ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="btn--sm"
                          onClick={() => setPrimaryLocation(loc.id)}
                        >
                          Set as primary
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="danger"
                        className="btn--sm"
                        onClick={() => removeLocation(loc.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="grid-2col">
                    <Input
                      id={`client-loc-label-${loc.id}`}
                      label="Label *"
                      placeholder="e.g. Main store, Warehouse"
                      value={loc.label}
                      onChange={(e) =>
                        updateLocation(loc.id, 'label', e.target.value)
                      }
                      error={locationErrors[loc.id]?.label}
                    />
                    <Input
                      id={`client-loc-recipient-${loc.id}`}
                      label="Recipient"
                      placeholder="e.g. Central Opticians — Warehouse"
                      value={loc.recipient}
                      onChange={(e) =>
                        updateLocation(loc.id, 'recipient', e.target.value)
                      }
                    />
                  </div>

                  <div className="grid-2col">
                    <Input
                      id={`client-loc-careof-${loc.id}`}
                      label="C/O (Care Of)"
                      placeholder="e.g. C/O Purchasing Department"
                      value={loc.careOf}
                      onChange={(e) =>
                        updateLocation(loc.id, 'careOf', e.target.value)
                      }
                    />
                    <Input
                      id={`client-loc-phone-${loc.id}`}
                      label="Location Phone"
                      type="tel"
                      placeholder="e.g. 244100201"
                      value={loc.phone}
                      onChange={(e) =>
                        updateLocation(loc.id, 'phone', e.target.value)
                      }
                    />
                  </div>

                  <div className="grid-2col">
                    <PostalCodeInput
                      id={`client-loc-postal-${loc.id}`}
                      label="Postal Code"
                      value={loc.postalCode}
                      onValueChange={(postalCode) =>
                        updateLocation(loc.id, 'postalCode', postalCode)
                      }
                    />
                  </div>

                  <TextArea
                    id={`client-loc-address-${loc.id}`}
                    label="Delivery Address"
                    placeholder="Enter a distinct delivery address for physical lens shipments (Ship To)"
                    rows={3}
                    value={loc.address}
                    onChange={(e) =>
                      updateLocation(loc.id, 'address', e.target.value)
                    }
                  />
                </div>
              ))}

              <div className="delivery-locations-add">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addLocation}
                >
                  Add delivery location
                </Button>
              </div>
            </div>

            <div className="form-section-label all-caps">Payment terms</div>
            <p className="form-section-hint">
              Default for new orders from this optician. Can be changed on each
              order.
            </p>
            <div
              className="theme-pref-group"
              role="radiogroup"
              aria-label="Payment terms"
            >
              {(
                [
                  { value: 'a_pronto', label: 'Due on receipt' },
                  { value: 'net_30', label: 'Net 30' },
                ] as const
              ).map((option) => {
                const active = form.paymentTerms === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={
                      active
                        ? 'theme-pref-option theme-pref-option--active'
                        : 'theme-pref-option'
                    }
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        paymentTerms: option.value as PaymentTerms,
                      }))
                    }
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="form-section-label all-caps">
              Default Commercial Discount
            </div>
            <p className="form-section-hint">
              Percentage and/or fixed euro amount — both optional.
            </p>

            <div className="discount-inputs">
              <div className="form-group">
                <span className="all-caps discount-input-label">
                  Discount (%)
                </span>
                <input
                  id="client-discount-pct"
                  type="number"
                  className="input-field"
                  min={0}
                  max={100}
                  step="0.01"
                  value={percentInput}
                  onChange={(e) => setPercentInput(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="all-caps discount-input-label">
                  Discount (€)
                </span>
                <input
                  id="client-discount-val"
                  type="number"
                  className="input-field"
                  min={0}
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/clientes')}
              >
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={saving}>
                {saving ? 'Saving…' : 'Save Client'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
