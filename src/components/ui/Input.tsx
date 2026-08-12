import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import './Input.css'

interface FieldProps {
  label: string
  id: string
  error?: string
}

type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>
type TextAreaProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export function Input({ label, id, error, className = '', ...rest }: InputProps) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`input-field ${className}`.trim()} {...rest} />
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}

export function TextArea({
  label,
  id,
  error,
  className = '',
  ...rest
}: TextAreaProps) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className={`input-field input-field--textarea ${className}`.trim()}
        {...rest}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
