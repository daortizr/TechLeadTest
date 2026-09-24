import { useState } from 'react'
import { Button } from '../../components'
import './AdminPage.css'

interface AdminLoginPageProps {
  onLoginSuccess: () => void
}

export default function AdminLoginPage({ onLoginSuccess }: AdminLoginPageProps): React.ReactElement {
  const [credentials, setCredentials] = useState({ username: '', password: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simple client-side login (admin/admin)
    if (credentials.username === 'admin' && credentials.password === 'admin') {
      sessionStorage.setItem('admin-logged-in', 'true')
      onLoginSuccess()
    } else {
      alert('Credenciales inválidas')
    }
  }

  return (
    <div className="admin-login-page">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>Acceso Administrativo</h1>

        <div className="form-group">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            type="text"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            required
          />
        </div>

        <Button type="submit">Acceder</Button>
      </form>
    </div>
  )
}
