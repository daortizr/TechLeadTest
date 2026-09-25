import React from 'react'
import './StatusPill.css'

interface StatusPillProps {
  tone: 'ok' | 'muted' | 'amber'
  icon?: React.ReactNode
  children: React.ReactNode
}

// A status is always icon plus text, never only a color
export default function StatusPill({ tone, icon, children }: StatusPillProps): React.ReactElement {
  return (
    <span className={`pill pill--${tone}`}>
      {icon}
      <span>{children}</span>
    </span>
  )
}
