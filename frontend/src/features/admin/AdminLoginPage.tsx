import React, { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertIcon, Button, LockIcon, TextField } from '../../components'
import { ADMIN_LABELS } from '../../lib/labels'
import { DEFAULT_ADMIN_PATH, loginAdmin, safeAdminPath, useAdminSession } from './adminSession'
import './AdminLoginPage.css'

const L = ADMIN_LABELS.login

export default function AdminLoginPage(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const loggedIn = useAdminSession()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)

  // Already signed in: nothing to do here
  if (loggedIn) {
    return <Navigate to={DEFAULT_ADMIN_PATH} replace />
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (loginAdmin(username, password)) {
      // Back to the screen they tried to open; straight to the login means the default one
      const from = (location.state as { from?: unknown } | null)?.from
      navigate(safeAdminPath(from), { replace: true })
      return
    }

    // One message for any failure, so it never tells which field was wrong
    setFailed(true)
    setPassword('')
    document.getElementById('password')?.focus()
  }

  return (
    <div className="login-card card">
      <span className="login-card__icon" aria-hidden="true">
        <LockIcon size={34} />
      </span>
      <h1 className="login-card__title">{L.title}</h1>
      <p className="login-card__subtitle">{L.subtitle}</p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <TextField
          id="username"
          name="username"
          label={L.username}
          value={username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          onChange={(event) => setUsername(event.target.value)}
        />
        <TextField
          id="password"
          name="password"
          type="password"
          label={L.password}
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />

        {/* role="alert": announced as soon as it appears */}
        <div className="login-form__message" role="alert">
          {failed && (
            <p className="login-form__error">
              <AlertIcon size={18} />
              <span>{L.invalid}</span>
            </p>
          )}
        </div>

        <Button type="submit" fullWidth>
          {L.submit}
        </Button>
      </form>
    </div>
  )
}
