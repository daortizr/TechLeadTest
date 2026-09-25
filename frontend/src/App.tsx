import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components'
import { StoreProvider } from './realtime'
import SearchPage from './features/flights/SearchPage'
import PlaceholderPage from './features/common/PlaceholderPage'
import SeatMapPage from './features/seat/SeatMapPage'
import CheckoutPage from './features/checkout/CheckoutPage'
import BookingPage from './features/booking/BookingPage'
import AdminLayout from './features/admin/AdminLayout'
import AdminDashboardPage from './features/admin/AdminDashboardPage'
import FlightDashboardPage from './features/admin/dashboard/FlightDashboardPage'
import AdminLoginPage from './features/admin/AdminLoginPage'
import RequireAdmin from './features/admin/RequireAdmin'
import { ADMIN_LABELS } from './lib/labels'

const IN_PROGRESS = 'Esta pantalla se está construyendo.'

export default function App(): React.ReactElement {
  return (
    <StoreProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<SearchPage />} />
          <Route path="/flights/:flightId" element={<SeatMapPage />} />
          <Route path="/flights/:flightId/checkout" element={<CheckoutPage />} />
          <Route path="/booking/:code" element={<BookingPage />} />
          <Route
            path="*"
            element={<PlaceholderPage title="Página no encontrada" description="La dirección que buscas no existe." />}
          />
        </Route>

        {/* Everything administrative lives under /admin, in its own frame; only the login is open */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="login" element={<AdminLoginPage />} />
          <Route element={<RequireAdmin />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="dashboard/:flightId" element={<FlightDashboardPage />} />
            <Route
              path="flights"
              element={<PlaceholderPage title={ADMIN_LABELS.simulation.title} description={IN_PROGRESS} />}
            />
            <Route
              path="*"
              element={<PlaceholderPage title="Página no encontrada" description="La dirección que buscas no existe." />}
            />
          </Route>
        </Route>
      </Routes>
    </StoreProvider>
  )
}
