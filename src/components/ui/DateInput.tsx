import { useEffect, useId, useRef, useState } from 'react'
import {
  formatPtDateInput,
  isoDateToPt,
  ptDateToIso,
} from '../../lib/ptFormat'
import './Input.css'
import './DateInput.css'

interface DateInputProps {
  label: string
  id: string
  /** Stored value as ISO `YYYY-MM-DD`. */
  value: string
  onValueChange: (isoDate: string) => void
  disabled?: boolean
  error?: string
  required?: boolean
}

export function DateInput({
  label,
  id,
  value,
  onValueChange,
  disabled,
  error,
  required,
}: DateInputProps) {
  const nativeId = useId()
  const nativeRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => isoDateToPt(value))

  useEffect(() => {
    setDraft(isoDateToPt(value))
  }, [value])

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="date-input-wrap">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          maxLength={10}
          disabled={disabled}
          required={required}
          className="input-field date-input-text"
          value={draft}
          onChange={(e) => {
            const next = formatPtDateInput(e.target.value)
            setDraft(next)
            const iso = ptDateToIso(next)
            if (iso) onValueChange(iso)
            else if (next.replace(/\D/g, '').length === 0) onValueChange('')
          }}
          onBlur={() => {
            const iso = ptDateToIso(draft)
            if (iso) {
              setDraft(isoDateToPt(iso))
              onValueChange(iso)
              return
            }
            setDraft(isoDateToPt(value))
          }}
        />
        <input
          ref={nativeRef}
          id={nativeId}
          type="date"
          className="date-input-native"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const iso = e.target.value
            onValueChange(iso)
            setDraft(isoDateToPt(iso))
          }}
        />
        <button
          type="button"
          className="date-input-calendar"
          disabled={disabled}
          aria-label="Open calendar"
          onClick={() => {
            const el = nativeRef.current
            if (!el) return
            try {
              el.showPicker()
            } catch {
              el.click()
            }
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="5"
              width="18"
              height="16"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M3 9h18M8 3v4M16 3v4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
