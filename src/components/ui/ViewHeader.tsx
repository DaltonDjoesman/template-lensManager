import type { ReactNode } from 'react'
import './ViewHeader.css'

interface ViewHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function ViewHeader({ title, subtitle, actions }: ViewHeaderProps) {
  return (
    <div className="view-header">
      <div className="view-header-title">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="view-header-actions">{actions}</div> : null}
    </div>
  )
}
