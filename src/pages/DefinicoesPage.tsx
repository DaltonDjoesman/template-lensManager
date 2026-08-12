import { useEffect, useState, type FormEvent } from 'react'
import { ViewHeader } from '../components/ui/ViewHeader'
import { Card } from '../components/ui/Card'
import { Input, TextArea } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import {
  loadCompanySettings,
  saveCompanySettings,
} from '../lib/companySettings'
import {
  restoreSeedDemoData,
  wipeAllDemoData,
} from '../lib/demoData'
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../lib/theme'
import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from '../types/companySettings'
import '../components/ui/Card.css'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function DefinicoesPage() {
  const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS)
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await loadCompanySettings()
        if (!cancelled) setForm(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load settings.',
          )
          setForm({ ...DEFAULT_COMPANY_SETTINGS })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  function updateField<K extends keyof CompanySettings>(
    key: K,
    value: CompanySettings[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleThemeChange(next: ThemePreference) {
    setThemePreference(next)
    setTheme(next)
    setToast('Appearance updated.')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveCompanySettings(form)
      setToast('Settings saved.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleWipeAll() {
    const confirmed = window.confirm(
      'Wipe all clients, catalog products, and orders? Company settings reset to demo placeholders. This cannot be undone.',
    )
    if (!confirmed) return

    setDemoBusy(true)
    setError(null)
    try {
      await wipeAllDemoData()
      setForm({ ...DEFAULT_COMPANY_SETTINGS })
      setToast('All demo data wiped. Lists are empty.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not wipe demo data.',
      )
    } finally {
      setDemoBusy(false)
    }
  }

  async function handleRestoreSeed() {
    const confirmed = window.confirm(
      'Replace current clients, catalog, and orders with the fictional seed dataset? Local edits will be lost.',
    )
    if (!confirmed) return

    setDemoBusy(true)
    setError(null)
    try {
      await restoreSeedDemoData()
      setForm({ ...DEFAULT_COMPANY_SETTINGS })
      setToast('Seed dataset restored.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not restore seed data.',
      )
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <div className="sub-view settings-view">
      <ViewHeader
        title="System Settings"
        subtitle="Legal and corporate data for Lens Manager document headers and invoices."
      />

      <Card title="Appearance" className="settings-card">
        <p className="theme-pref-hint">
          Choose light, dark, or follow the system preference. The change
          applies immediately on this device.
        </p>
        <div
          className="theme-pref-group"
          role="radiogroup"
          aria-label="Interface theme"
        >
          {THEME_OPTIONS.map((option) => {
            const active = theme === option.value
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
                onClick={() => handleThemeChange(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title="Global Billing and MDR Data" className="settings-card">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Loading settings…</p>
        ) : (
          <form onSubmit={handleSubmit} className="settings-form">
            {error ? (
              <div className="login-error login-error--visible" role="alert">
                {error}
              </div>
            ) : null}

            <div className="grid-2col">
              <Input
                id="settings-company-name"
                label="Legal Company Name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
              <Input
                id="settings-company-nif"
                label="Head Office Tax ID"
                value={form.nif}
                onChange={(e) => updateField('nif', e.target.value)}
              />
            </div>

            <div className="grid-2col">
              <Input
                id="settings-company-phone"
                label="General Phone"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              <Input
                id="settings-company-email"
                label="Business Email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>

            <TextArea
              id="settings-company-address"
              label="Registered Office Address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />

            <div className="legal-block">
              <span className="all-caps">Legal Text and Exemptions (PDF)</span>
              <Input
                id="settings-company-mdr"
                label="MDR Declaration (Medical Device Regulation)"
                value={form.mdrNote}
                onChange={(e) => updateField('mdrNote', e.target.value)}
                style={{ fontSize: 13 }}
              />
              <Input
                id="settings-company-iva"
                label="VAT Notice / Legal Exemption"
                value={form.ivaNote}
                onChange={(e) => updateField('ivaNote', e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            <div className="settings-actions">
              <Button type="submit" variant="accent" disabled={saving}>
                {saving ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Demo data" className="settings-card">
        <p className="theme-pref-hint">
          First visit loads a fictional dataset automatically. Use these
          actions to clear everything or reload the seed. Both overwrite
          local browser data for this origin.
        </p>
        <div className="settings-actions settings-actions--demo">
          <Button
            type="button"
            variant="danger"
            disabled={demoBusy || loading}
            onClick={() => void handleWipeAll()}
          >
            {demoBusy ? 'Working…' : 'Wipe all'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={demoBusy || loading}
            onClick={() => void handleRestoreSeed()}
          >
            {demoBusy ? 'Working…' : 'Restore seed'}
          </Button>
        </div>
      </Card>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
