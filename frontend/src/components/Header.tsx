import { useStore } from '../realtime'
import './Header.css'

export default function Header({ title }: { title: string }) {
  const { state } = useStore()

  const connectionText = {
    connecting: 'Conectando...',
    live: 'En vivo',
    reconnecting: 'Reconectando...',
  }[state.connection.state]

  const connectionClass = `connection-indicator ${state.connection.state}`

  return (
    <header className="header">
      <div className="header-content">
        <h1>{title}</h1>
        <div className={connectionClass}>
          <span className="dot"></span>
          {connectionText}
        </div>
      </div>
    </header>
  )
}
