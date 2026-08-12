import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './Button.css'

type Variant = 'primary' | 'accent' | 'secondary' | 'success' | 'info' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', className = '', children, disabled, ...rest },
    ref,
  ) {
    const classes = [
      'btn',
      `btn--${variant}`,
      disabled ? 'btn--disabled' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    )
  },
)
