import React from 'react'
import { Outlet } from 'react-router-dom'
import Header, { ConnectionIndicator } from './Header'
import NoticeRegion from './NoticeRegion'
import './AppLayout.css'

// Public frame: header with the connection indicator, temporary notices and the page
export default function AppLayout(): React.ReactElement {
  return (
    <>
      <Header>
        <ConnectionIndicator />
      </Header>
      <NoticeRegion />
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
