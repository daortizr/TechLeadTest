import React from 'react'
import { Outlet } from 'react-router-dom'
import { ConnectionIndicator, Header, NoticeRegion } from '../../components'
import { ADMIN_LABELS } from '../../lib/labels'
import { useAdminSession } from './adminSession'

// The admin area's own frame. The login shows the bare header; once signed in the title becomes
// "Panel administrativo" and the connection indicator appears. Each screen brings its own back button.
export default function AdminLayout(): React.ReactElement {
  const loggedIn = useAdminSession()

  return (
    <>
      <Header
        title={loggedIn ? ADMIN_LABELS.frame.title : undefined}
        homeTo={loggedIn ? '/admin/dashboard' : '/'}
      >
        {loggedIn && <ConnectionIndicator />}
      </Header>

      <NoticeRegion />
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
