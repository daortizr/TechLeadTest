import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminSession } from './adminSession'

// Wraps every admin route except the login. Without a session it sends the user to the login,
// remembering where they were headed so they land there afterwards.
export default function RequireAdmin(): React.ReactElement {
  const loggedIn = useAdminSession()
  const location = useLocation()

  if (!loggedIn) {
    return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}
