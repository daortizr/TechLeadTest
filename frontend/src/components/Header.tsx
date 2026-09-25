import React from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../realtime'
import { CONNECTION_LABELS } from '../lib/labels'
import { PlaneIcon } from './icons'
import './Header.css'

export function ConnectionIndicator(): React.ReactElement {
  const { state } = useStore()
  const connection = state.connection.state

  return (
    <div className={`connection connection--${connection}`} role="status">
      <span className="connection__dot" aria-hidden="true" />
      <span>{CONNECTION_LABELS[connection]}</span>
    </div>
  )
}

interface HeaderProps {
  title?: string
  // Where the brand leads; the admin frame points it at its own home
  homeTo?: string
  // What goes on the right: the connection indicator (public), the admin navigation, or nothing (login)
  children?: React.ReactNode
}

export default function Header({ title = 'Reserva de vuelos', homeTo = '/', children }: HeaderProps): React.ReactElement {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to={homeTo} className="brand" aria-label={`${title}, ir al inicio`}>
          <span className="brand__icon">
            <PlaneIcon size={22} />
          </span>
          <span className="brand__title">{title}</span>
        </Link>
        {children}
      </div>
    </header>
  )
}
