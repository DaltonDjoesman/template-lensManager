import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input, TextArea } from '../components/ui/Input'
import { listClients } from '../lib/clients'
import { loadCompanySettings } from '../lib/companySettings'
import { listProducts, formatEur as formatProductEur } from '../lib/products'
import {
  confirmOrder,
  createOrder,
  ensurePfNumber,
  formatEur,
  getOrder,
  updateOrder,
} from '../lib/orders'
import { downloadOrderPdf } from '../lib/orderPdf'
import type { Client, ClientDeliveryLocation } from '../types/client'
import type { Product } from '../types/product'
import type { CompanySettings } from '../types/companySettings'
import {
  EMPTY_SHIPPING_SNAPSHOT,
  buildLineSku,
  computeLineNetContributions,
  computeOrderTotals,
  createEmptyOrderLine,
  formatLineDiscountLabel,
  todayIsoDate,
  type Order,
  type OrderInput,
  type OrderLine,
  type OrderShippingSnapshot,
  type OrderStatus,
} from '../types/order'
import '../components/ui/Card.css'

function shippingFromLocation(
  loc: ClientDeliveryLocation,
): OrderShippingSnapshot {
  return {
    recipient: loc.recipient,
    careOf: loc.careOf,
    phone: loc.phone,
    address: loc.address,
    postalCode: loc.postalCode,
  }
}

function primaryLocation(
  locations: ClientDeliveryLocation[],
): ClientDeliveryLocation | undefined {
  return locations.find((l) => l.isPrimary) ?? locations[0]
}

interface AmplitudeIssue {
  lineId: string
  label: string
  detail: string
}

function findAmplitudeIssues(
  lines: OrderLine[],
  products: Product[],
): AmplitudeIssue[] {
  const byId = new Map(products.map((p) => [p.id, p]))
  const issues: AmplitudeIssue[] = []

  for (const line of lines) {
    if (!line.productId) continue
    const product = byId.get(line.productId)
    if (!product) continue

    const outOfSph = line.sph < product.sphMin || line.sph > product.sphMax
    const outOfCyl = line.cyl < product.cylMin || line.cyl > product.cylMax
    if (!outOfSph && !outOfCyl) continue

    const parts: string[] = []
    if (outOfSph) {
      parts.push(
        `SPH ${line.sph.toFixed(2)} outside ${product.sphMin.toFixed(2)}…${product.sphMax.toFixed(2)}`,
      )
    }
    if (outOfCyl) {
      parts.push(
        `CYL ${line.cyl.toFixed(2)} outside ${product.cylMin.toFixed(2)}…${product.cylMax.toFixed(2)}`,
      )
    }
    issues.push({
      lineId: line.id,
      label: line.familySku || product.sku,
      detail: parts.join('; '),
    })
  }

  return issues
}

function emptyFormState(company: CompanySettings): OrderInput {
  return {
    status: 'Draft',
    clientId: '',
    clientName: '',
    clientNif: '',
    clientPo: '',
    notes: '',
    orderDate: todayIsoDate(),
    billing: {
      name: '',
      nif: '',
      contactName: '',
      phone: '',
      email: '',
      address: '',
    },
    shipping: { ...EMPTY_SHIPPING_SNAPSHOT },
    company: { ...company },
    orderDiscount: {},
    clientDefaultDiscount: {},
    lines: [createEmptyOrderLine()],
  }
}

function orderToInput(order: Order): OrderInput {
  return {
    status: order.status,
    clientId: order.clientId,
    clientName: order.clientName,
    clientNif: order.clientNif,
    clientPo: order.clientPo,
    notes: order.notes,
    orderDate: order.orderDate,
    billing: { ...order.billing },
    shipping: { ...order.shipping },
    company: { ...order.company },
    deliveryLocationId: order.deliveryLocationId,
    orderDiscount: { ...order.orderDiscount },
    clientDefaultDiscount: { ...order.clientDefaultDiscount },
    lines: order.lines.map((l) => ({ ...l })),
    pedNumber: order.pedNumber,
    pfNumber: order.pfNumber,
    confirmedAt: order.confirmedAt,
  }
}

export function PedidoFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'novo'
  const navigate = useNavigate()

  const [clients, setClients] = useState<Client[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<OrderInput | null>(null)
  const [pedNumber, setPedNumber] = useState<string | undefined>()
  const [pfNumber, setPfNumber] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [amplitudeBanner, setAmplitudeBanner] = useState<AmplitudeIssue[] | null>(
    null,
  )
  const [pendingAction, setPendingAction] = useState<
    null | 'save' | 'confirm'
  >(null)
  const [activeTab, setActiveTab] = useState<'info' | 'lenses' | 'company'>(
    'info',
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const [clientData, productData, company] = await Promise.all([
          listClients(),
          listProducts(),
          loadCompanySettings(),
        ])
        if (cancelled) return
        setClients(clientData)
        setProducts(productData)

        if (isNew) {
          setForm(emptyFormState(company))
          setPedNumber(undefined)
          setPfNumber(undefined)
        } else {
          const order = await getOrder(id!)
          if (cancelled) return
          if (!order) {
            setError('Order not found.')
            setForm(null)
          } else {
            setForm(orderToInput(order))
            setPedNumber(order.pedNumber)
            setPfNumber(order.pfNumber)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the order.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  const totals = useMemo(() => {
    if (!form) {
      return computeOrderTotals([], {})
    }
    return computeOrderTotals(form.lines, form.orderDiscount)
  }, [form])

  const lineContributions = useMemo(() => {
    if (!form) return []
    return computeLineNetContributions(form.lines, form.orderDiscount)
  }, [form])

  const contributionByLineId = useMemo(() => {
    const map = new Map(
      lineContributions.map((c) => [c.line.id, c] as const),
    )
    return map
  }, [lineContributions])

  const selectedClient = clients.find((c) => c.id === form?.clientId)
  const readOnly =
    form?.status === 'Cancelled' || form?.status === 'Completed'

  function patchForm(patch: Partial<OrderInput>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function applyClient(clientId: string) {
    const client = clients.find((c) => c.id === clientId)
    if (!client || !form) return

    const primary = primaryLocation(client.deliveryLocations)
    patchForm({
      clientId: client.id,
      clientName: client.billing.name,
      clientNif: client.billing.nif,
      billing: { ...client.billing },
      orderDiscount: { ...client.defaultDiscount },
      clientDefaultDiscount: { ...client.defaultDiscount },
      deliveryLocationId: primary?.id,
      shipping: primary
        ? shippingFromLocation(primary)
        : { ...EMPTY_SHIPPING_SNAPSHOT },
    })
  }

  function applyDeliveryLocation(locationId: string) {
    if (!selectedClient) return
    const loc = selectedClient.deliveryLocations.find((l) => l.id === locationId)
    if (!loc) return
    patchForm({
      deliveryLocationId: loc.id,
      shipping: shippingFromLocation(loc),
    })
  }

  function updateLine(lineId: string, patch: Partial<OrderLine>) {
    if (!form) return
    const lines = form.lines.map((line) => {
      if (line.id !== lineId) return line
      const next = { ...line, ...patch }
      if (next.familySku) {
        next.lineSku = buildLineSku(next.familySku, next.sph, next.cyl)
      }
      return next
    })
    patchForm({ lines })
  }

  function selectFamily(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) {
      updateLine(lineId, {
        productId: '',
        familySku: '',
        description: '',
        unitPrice: 0,
        lineSku: '',
      })
      return
    }
    updateLine(lineId, {
      productId: product.id,
      familySku: product.sku,
      description: product.description,
      unitPrice: product.unitPrice,
      lineSku: buildLineSku(product.sku, 0, 0),
    })
  }

  function addLine() {
    if (!form) return
    patchForm({ lines: [...form.lines, createEmptyOrderLine()] })
  }

  function removeLine(lineId: string) {
    if (!form) return
    if (form.lines.length <= 1) {
      patchForm({ lines: [createEmptyOrderLine()] })
      return
    }
    patchForm({ lines: form.lines.filter((l) => l.id !== lineId) })
  }

  function validateBasic(): string | null {
    if (!form) return 'Form not loaded.'
    if (!form.clientId) return 'Select the client optician.'
    if (!form.orderDate) return 'Enter the order date.'
    return null
  }

  async function persistDraft(): Promise<string> {
    if (!form) throw new Error('Form not loaded.')
    const input: OrderInput = {
      ...form,
      status: form.status === 'Draft' ? 'Draft' : form.status,
      lines: form.lines
        .filter((l) => l.productId)
        .map((l) => ({
          ...l,
          lineSku: buildLineSku(l.familySku, l.sph, l.cyl),
        })),
    }

    if (isNew) {
      const newId = await createOrder({ ...input, status: 'Draft' })
      return newId
    }

    await updateOrder(id!, { ...input, status: form.status })
    return id!
  }

  async function runSave(skipAmplitudeCheck = false) {
    const basic = validateBasic()
    if (basic) {
      setError(basic)
      return
    }
    if (!form) return

    const issues = findAmplitudeIssues(form.lines, products)
    if (!skipAmplitudeCheck && issues.length > 0) {
      setAmplitudeBanner(issues)
      setPendingAction('save')
      return
    }

    setSaving(true)
    setError(null)
    setAmplitudeBanner(null)
    setPendingAction(null)
    try {
      const savedId = await persistDraft()
      setToast('Draft saved.')
      if (isNew) {
        navigate(`/pedidos/${savedId}`, { replace: true })
      } else {
        const refreshed = await getOrder(savedId)
        if (refreshed) {
          setForm(orderToInput(refreshed))
          setPedNumber(refreshed.pedNumber)
          setPfNumber(refreshed.pfNumber)
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function runConfirm(skipAmplitudeCheck = false) {
    const basic = validateBasic()
    if (basic) {
      setError(basic)
      return
    }
    if (!form) return

    const linesWithProduct = form.lines.filter((l) => l.productId)
    if (linesWithProduct.length === 0) {
      setError('Cannot confirm an order without line items.')
      return
    }

    const issues = findAmplitudeIssues(linesWithProduct, products)
    if (!skipAmplitudeCheck && issues.length > 0) {
      setAmplitudeBanner(issues)
      setPendingAction('confirm')
      return
    }

    setSaving(true)
    setError(null)
    setAmplitudeBanner(null)
    setPendingAction(null)
    try {
      const savedId = await persistDraft()
      const confirmed = await confirmOrder(savedId)
      setForm(orderToInput(confirmed))
      setPedNumber(confirmed.pedNumber)
      setPfNumber(confirmed.pfNumber)
      setToast(`Order confirmed: ${confirmed.pedNumber}`)
      if (isNew) navigate(`/pedidos/${savedId}`, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not confirm.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(next: OrderStatus) {
    if (!form || isNew || !id) return
    setSaving(true)
    setError(null)
    try {
      await updateOrder(id, { ...form, status: next })
      const refreshed = await getOrder(id)
      if (refreshed) {
        setForm(orderToInput(refreshed))
        setPedNumber(refreshed.pedNumber)
        setPfNumber(refreshed.pfNumber)
      }
      setToast(`Status updated: ${next}`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update status.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadPedido() {
    if (!form || isNew || !id) {
      setError('Save the order before generating the PDF.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await persistDraft()
      const latest = await getOrder(id)
      if (!latest) throw new Error('Order not found.')
      setForm(orderToInput(latest))
      setPedNumber(latest.pedNumber)
      setPfNumber(latest.pfNumber)
      await downloadOrderPdf(latest, 'pedido')
      setToast('Order PDF downloaded.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate order PDF.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadProforma() {
    if (!form || isNew || !id) {
      setError('Save the order before generating the proforma.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await persistDraft()
      const assigned = await ensurePfNumber(id)
      const latest = await getOrder(id)
      if (!latest) throw new Error('Order not found.')
      setForm(orderToInput(latest))
      setPedNumber(latest.pedNumber)
      setPfNumber(assigned)
      await downloadOrderPdf({ ...latest, pfNumber: assigned }, 'proforma')
      setToast(`Proforma ${assigned} downloaded.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate proforma.',
      )
    } finally {
      setSaving(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void runSave(false)
  }

  if (loading || !form) {
    return (
      <div className="sub-view">
        <ViewHeader
          title={isNew ? 'New Order' : 'Order'}
          subtitle="Loading…"
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/pedidos')}
            >
              Back
            </Button>
          }
        />
        {error ? (
          <div className="login-error login-error--visible" role="alert">
            {error}
          </div>
        ) : (
          <p className="form-section-hint">Loading form…</p>
        )}
      </div>
    )
  }

  const title =
    pedNumber ??
    (form.status === 'Draft' ? 'Draft' : form.status)

  const filledLinesCount = form.lines.filter((l) => l.productId).length

  return (
    <div className="sub-view">
      <ViewHeader
        title={isNew ? 'Create Order' : title}
        subtitle="Detailed form for prescription line entry."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/pedidos')}
          >
            Back
          </Button>
        }
      />

      {error ? (
        <div className="login-error login-error--visible" role="alert">
          {error}
        </div>
      ) : null}

      {amplitudeBanner && amplitudeBanner.length > 0 ? (
        <div className="amplitude-alert" role="alertdialog">
          <strong>SPH/CYL outside family amplitude</strong>
          <ul>
            {amplitudeBanner.map((issue) => (
              <li key={issue.lineId}>
                {issue.label}: {issue.detail}
              </li>
            ))}
          </ul>
          <p>
            You can continue anyway. Amplitude is a warning only, not a blocker.
          </p>
          <div className="amplitude-alert-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAmplitudeBanner(null)
                setPendingAction(null)
              }}
            >
              Back to editing
            </Button>
            <Button
              type="button"
              variant="accent"
              disabled={saving}
              onClick={() => {
                if (pendingAction === 'confirm') void runConfirm(true)
                else void runSave(true)
              }}
            >
              Continue anyway
            </Button>
          </div>
        </div>
      ) : null}

      <form className="order-form-grid" onSubmit={onSubmit}>
        <Card className="order-main-card">
          <div className="card-title-row">
            <span>Order</span>
            <span className={`badge badge-${form.status === 'Draft' ? 'draft' : form.status === 'Confirmed' ? 'confirmed' : form.status === 'Completed' ? 'completed' : 'cancelled'}`}>
              {form.status}
            </span>
          </div>

          <div className="order-tabs" role="tablist" aria-label="Order sections">
            <button
              type="button"
              role="tab"
              id="order-tab-info"
              aria-selected={activeTab === 'info'}
              aria-controls="order-panel-info"
              className={`order-tab${activeTab === 'info' ? ' order-tab--active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Information
            </button>
            <button
              type="button"
              role="tab"
              id="order-tab-lenses"
              aria-selected={activeTab === 'lenses'}
              aria-controls="order-panel-lenses"
              className={`order-tab${activeTab === 'lenses' ? ' order-tab--active' : ''}`}
              onClick={() => setActiveTab('lenses')}
            >
              Lenses ({filledLinesCount})
            </button>
            <button
              type="button"
              role="tab"
              id="order-tab-company"
              aria-selected={activeTab === 'company'}
              aria-controls="order-panel-company"
              className={`order-tab${activeTab === 'company' ? ' order-tab--active' : ''}`}
              onClick={() => setActiveTab('company')}
            >
              Company
            </button>
          </div>

          {activeTab === 'info' ? (
            <div
              role="tabpanel"
              id="order-panel-info"
              aria-labelledby="order-tab-info"
              className="order-tab-panel"
            >
              <div className="grid-2col">
                <div className="form-group">
                  <label htmlFor="order-client">Client Optician *</label>
                  <select
                    id="order-client"
                    className="input-field"
                    value={form.clientId}
                    disabled={readOnly || form.status !== 'Draft'}
                    onChange={(e) => applyClient(e.target.value)}
                    required
                  >
                    <option value="">Select client…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.billing.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  id="order-po"
                  label="Client PO Reference"
                  value={form.clientPo}
                  disabled={readOnly}
                  onChange={(e) => patchForm({ clientPo: e.target.value })}
                />
              </div>

              <div className="grid-2col">
                <Input
                  id="order-date"
                  label="Order Date"
                  type="date"
                  value={form.orderDate}
                  disabled={readOnly}
                  onChange={(e) => patchForm({ orderDate: e.target.value })}
                />
                <Input
                  id="order-notes"
                  label="Internal Notes"
                  value={form.notes}
                  disabled={readOnly}
                  onChange={(e) => patchForm({ notes: e.target.value })}
                />
              </div>

              <p className="form-section-label all-caps">Billing (snapshot)</p>
              <div className="grid-2col">
                <Input
                  id="bill-name"
                  label="Name"
                  value={form.billing.name}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      billing: { ...form.billing, name: e.target.value },
                    })
                  }
                />
                <Input
                  id="bill-nif"
                  label="Tax ID"
                  value={form.billing.nif}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      billing: { ...form.billing, nif: e.target.value },
                    })
                  }
                />
                <Input
                  id="bill-contact"
                  label="Contact"
                  value={form.billing.contactName}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      billing: { ...form.billing, contactName: e.target.value },
                    })
                  }
                />
                <Input
                  id="bill-phone"
                  label="Phone"
                  value={form.billing.phone}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      billing: { ...form.billing, phone: e.target.value },
                    })
                  }
                />
                <Input
                  id="bill-email"
                  label="Email"
                  value={form.billing.email}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      billing: { ...form.billing, email: e.target.value },
                    })
                  }
                />
                <TextArea
                  id="bill-address"
                  label="Address"
                  rows={2}
                  value={form.billing.address}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      billing: { ...form.billing, address: e.target.value },
                    })
                  }
                />
              </div>

              <p className="form-section-label all-caps">Delivery (snapshot)</p>

              {!form.clientId ? (
                <p className="form-section-hint">
                  Select the client optician to choose a delivery location.
                </p>
              ) : selectedClient && selectedClient.deliveryLocations.length > 0 ? (
                <div className="form-group">
                  <label htmlFor="order-delivery-loc">Client delivery location</label>
                  <select
                    id="order-delivery-loc"
                    className="input-field"
                    value={form.deliveryLocationId ?? ''}
                    disabled={readOnly}
                    onChange={(e) => applyDeliveryLocation(e.target.value)}
                  >
                    {selectedClient.deliveryLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.label}
                        {loc.isPrimary ? ' (primary)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="form-section-hint">
                    Choosing a location fills the fields below. You can still
                    edit the snapshot for this order only.
                  </p>
                </div>
              ) : (
                <p className="form-section-hint">
                  This client has no delivery locations on file — fill in
                  manually or add locations under Clients.
                </p>
              )}

              <div className="grid-2col">
                <Input
                  id="ship-recipient"
                  label="Recipient"
                  value={form.shipping.recipient}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      shipping: { ...form.shipping, recipient: e.target.value },
                    })
                  }
                />
                <Input
                  id="ship-careof"
                  label="C/O"
                  value={form.shipping.careOf}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      shipping: { ...form.shipping, careOf: e.target.value },
                    })
                  }
                />
                <Input
                  id="ship-phone"
                  label="Phone"
                  value={form.shipping.phone}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      shipping: { ...form.shipping, phone: e.target.value },
                    })
                  }
                />
                <Input
                  id="ship-postal"
                  label="Postal Code"
                  value={form.shipping.postalCode}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      shipping: { ...form.shipping, postalCode: e.target.value },
                    })
                  }
                />
                <TextArea
                  id="ship-address"
                  label="Address"
                  rows={2}
                  value={form.shipping.address}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      shipping: { ...form.shipping, address: e.target.value },
                    })
                  }
                />
              </div>

            </div>
          ) : activeTab === 'lenses' ? (
            <div
              role="tabpanel"
              id="order-panel-lenses"
              aria-labelledby="order-tab-lenses"
              className="order-tab-panel"
            >
              <div className="order-lines-header-bar">
                <span className="all-caps">Order Lines</span>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="btn--sm"
                    onClick={addLine}
                  >
                    + Add Line
                  </Button>
                ) : null}
              </div>

              <div className="order-lines-container">
                {form.lines.map((line) => {
                  const contribution = contributionByLineId.get(line.id)
                  const appliedLabel = contribution
                    ? formatLineDiscountLabel(contribution, formatEur)
                    : '—'
                  const showPoolHint =
                    contribution !== undefined &&
                    !contribution.hasLineDiscount &&
                    contribution.discountAmount > 0

                  return (
                  <div key={line.id} className="order-line-row">
                    <div className="form-group">
                      <label className="order-line-label">Family</label>
                      <select
                        className="input-field"
                        value={line.productId}
                        disabled={readOnly}
                        onChange={(e) => selectFamily(line.id, e.target.value)}
                      >
                        <option value="">Select…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {formatProductEur(p.unitPrice)}
                          </option>
                        ))}
                      </select>
                      {line.lineSku ? (
                        <span className="line-sku-hint mono">{line.lineSku}</span>
                      ) : null}
                    </div>
                    <Input
                      id={`sph-${line.id}`}
                      label="SPH"
                      type="number"
                      step="0.25"
                      value={Number.isFinite(line.sph) ? line.sph : 0}
                      disabled={readOnly || !line.productId}
                      onChange={(e) =>
                        updateLine(line.id, { sph: Number(e.target.value) })
                      }
                    />
                    <Input
                      id={`cyl-${line.id}`}
                      label="CYL"
                      type="number"
                      step="0.25"
                      value={Number.isFinite(line.cyl) ? line.cyl : 0}
                      disabled={readOnly || !line.productId}
                      onChange={(e) =>
                        updateLine(line.id, { cyl: Number(e.target.value) })
                      }
                    />
                    <Input
                      id={`qty-${line.id}`}
                      label="Qty"
                      type="number"
                      min={1}
                      step={1}
                      value={line.qty}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateLine(line.id, {
                          qty: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                    <div className="form-group">
                      <label className="order-line-label">Unit Price</label>
                      <div className="order-line-readonly mono">
                        {formatEur(line.unitPrice)}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="order-line-label">Disc. %</label>
                      <input
                        id={`disc-${line.id}`}
                        type="number"
                        className="input-field"
                        min={0}
                        step={0.1}
                        disabled={readOnly}
                        value={line.discountPercent ?? ''}
                        onChange={(e) => {
                          if (!form) return
                          const raw = e.target.value
                          const lines = form.lines.map((l) => {
                            if (l.id !== line.id) return l
                            const next = { ...l }
                            if (raw === '') {
                              delete next.discountPercent
                              return next
                            }
                            const n = Number(raw)
                            if (!Number.isFinite(n)) {
                              delete next.discountPercent
                              return next
                            }
                            next.discountPercent = n
                            return next
                          })
                          patchForm({ lines })
                        }}
                      />
                      {showPoolHint ? (
                        <span className="line-sku-hint">
                          applied {appliedLabel} (order)
                        </span>
                      ) : null}
                    </div>
                    <div className="form-group">
                      <label className="order-line-label">Subtotal</label>
                      <div className="order-line-readonly mono order-line-subtotal">
                        {formatEur(contribution?.net ?? line.qty * line.unitPrice)}
                        {contribution && contribution.discountAmount > 0 ? (
                          <span className="line-gross-hint">
                            gross {formatEur(contribution.gross)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="danger"
                        className="btn--sm order-line-remove"
                        onClick={() => removeLine(line.id)}
                        aria-label="Remove line"
                      >
                        ×
                      </Button>
                    ) : (
                      <span />
                    )}
                  </div>
                  )
                })}
              </div>

              <div className="order-discount-block">
                <p className="form-section-label all-caps">Order discount</p>
                <p className="form-section-hint">
                  Applied to all lines without their own % discount. When you
                  select the optician, the default discount is copied here (you
                  can change it later).
                </p>
                <div className="discount-inputs">
                  <div>
                    <span className="discount-input-label">Percentage</span>
                    <input
                      type="number"
                      className="input-field"
                      min={0}
                      step={0.1}
                      disabled={readOnly}
                      value={form.orderDiscount.percent ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        const next = { ...form.orderDiscount }
                        if (raw === '') delete next.percent
                        else next.percent = Number(raw)
                        patchForm({ orderDiscount: next })
                      }}
                    />
                  </div>
                  <div>
                    <span className="discount-input-label">Amount (€)</span>
                    <input
                      type="number"
                      className="input-field"
                      min={0}
                      step={0.01}
                      disabled={readOnly}
                      value={form.orderDiscount.amountEur ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        const next = { ...form.orderDiscount }
                        if (raw === '') delete next.amountEur
                        else next.amountEur = Number(raw)
                        patchForm({ orderDiscount: next })
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="order-panel-company"
              aria-labelledby="order-tab-company"
              className="order-tab-panel"
            >
              <p className="form-section-label all-caps">
                Company data on document (snapshot)
              </p>
              <div className="grid-2col">
                <Input
                  id="co-name"
                  label="Company"
                  value={form.company.name}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      company: { ...form.company, name: e.target.value },
                    })
                  }
                />
                <Input
                  id="co-phone"
                  label="Phone"
                  value={form.company.phone}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      company: { ...form.company, phone: e.target.value },
                    })
                  }
                />
                <Input
                  id="co-email"
                  label="Email"
                  value={form.company.email}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      company: { ...form.company, email: e.target.value },
                    })
                  }
                />
                <TextArea
                  id="co-address"
                  label="Address"
                  rows={2}
                  value={form.company.address}
                  disabled={readOnly}
                  onChange={(e) =>
                    patchForm({
                      company: { ...form.company, address: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          )}
        </Card>

        <div className="order-side-column">
          <Card>
            <div className="card-title-row">Order Actions</div>
            <div className="order-actions-stack">
              {form.status === 'Draft' ? (
                <>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Draft'}
                  </Button>
                  <Button
                    type="button"
                    variant="info"
                    disabled={saving}
                    onClick={() => void runConfirm(false)}
                  >
                    Confirm Order
                  </Button>
                  {!isNew ? (
                    <Button
                      type="button"
                      variant="danger"
                      disabled={saving}
                      onClick={() => void changeStatus('Cancelled')}
                    >
                      Cancel Order
                    </Button>
                  ) : null}
                </>
              ) : null}

              {form.status === 'Confirmed' ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={saving}
                    onClick={() => void runSave(false)}
                  >
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    disabled={saving}
                    onClick={() => void changeStatus('Completed')}
                  >
                    Mark Completed
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={saving}
                    onClick={() => void changeStatus('Cancelled')}
                  >
                    Cancel Order
                  </Button>
                </>
              ) : null}

              {(form.status === 'Completed' || form.status === 'Cancelled') && (
                <p className="form-section-hint">
                  This order is {form.status.toLowerCase()} and can no longer be
                  edited.
                </p>
              )}
            </div>

            {!isNew ? (
              <div className="order-docs-block">
                <span className="all-caps">Document Generation</span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleDownloadPedido()}
                >
                  Generate Order PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void handleDownloadProforma()}
                >
                  Generate Proforma (PF)
                  {pfNumber ? ` — ${pfNumber}` : ''}
                </Button>
                <p className="form-section-hint">
                  PDFs are generated in the browser from current data. There is
                  no official invoice in this system.
                </p>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="card-title-row">Summary and Totals</div>
            <dl className="order-totals">
              <div>
                <dt>Pieces</dt>
                <dd className="mono">{totals.pieces}</dd>
              </div>
              <div>
                <dt>Line subtotal</dt>
                <dd className="mono">{formatEur(totals.linesSubtotal)}</dd>
              </div>
              <div>
                <dt>Discount applied</dt>
                <dd className="mono">{formatEur(totals.discountAmount)}</dd>
              </div>
              <div>
                <dt>Net excl. VAT</dt>
                <dd className="mono">{formatEur(totals.subtotalNet)}</dd>
              </div>
              <div>
                <dt>VAT 6%</dt>
                <dd className="mono">{formatEur(totals.iva)}</dd>
              </div>
              <div className="order-totals-grand">
                <dt>Total incl. VAT</dt>
                <dd className="mono">{formatEur(totals.totalWithVat)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </form>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
