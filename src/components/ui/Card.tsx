import type { ReactNode } from 'react'
import './Card.css'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`.trim()}>
      {title ? <div className="card-title">{title}</div> : null}
      {children}
    </div>
  )
}
