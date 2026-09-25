import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ConnectionIndicator, Header, NoticeRegion } from '../../components'
import { ADMIN_LABELS } from '../../lib/labels'
import { logoutAdmin, useAdminSession } from './adminSession'
import './AdminLayout.css'

// The admin area's own frame. The login shows the bare header; once signed in the title becomes
// "Panel administrativo", the connection indicator appears and a tab row (Simulación, Dashboard,
// Salir) sits under the header.
export default function AdminLayout(): React.ReactElement {
  const loggedIn = useAdminSession()
  const navigate = useNavigate()

  const logout = () => {
    logoutAdmin()
    navigate('/admin/login', { replace: true })
  }

  return (
    <>
      <Header
        title={loggedIn ? ADMIN_LABELS.frame.title : undefined}
        homeTo={loggedIn ? '/admin/dashboard' : '/'}
      >
        {loggedIn && <ConnectionIndicator />}
      </Header>

      {loggedIn && (
        <div className="admin-tabs">
          <nav className="admin-tabs__inner" aria-label={ADMIN_LABELS.nav.label}>
            <NavLink to="/admin/flights">{ADMIN_LABELS.nav.simulation}</NavLink>
            <NavLink to="/admin/dashboard">{ADMIN_LABELS.nav.dashboard}</NavLink>
            <button type="button" className="admin-tabs__logout" onClick={logout}>
              {ADMIN_LABELS.nav.logout}
            </button>
          </nav>
        </div>
      )}

      <NoticeRegion />
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
