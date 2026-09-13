import type { InputHTMLAttributes } from 'react'
import { formatPostalCode } from '../../lib/ptFormat'
import './Input.css'

interface PostalCodeInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label: string
  id: string
  value: string
  onValueChange: (value: string) => void
  error?: string
}

export function PostalCodeInput({
  label,
  id,
  value,
  onValueChange,
  error,
  className = '',
  disabled,
  ...rest
}: PostalCodeInputProps) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input
        {...rest}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="____-___"
        maxLength={8}
        disabled={disabled}
        className={`input-field ${className}`.trim()}
        value={formatPostalCode(value)}
        onChange={(e) => onValueChange(formatPostalCode(e.target.value))}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
