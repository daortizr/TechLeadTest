import { useState } from 'react'
import Header from './components/Header'
import './styles/Router.css'

export default function Router() {
  const [page, setPage] = useState<'search' | 'map' | 'checkout' | 'booking' | 'admin-login' | 'admin-dashboard'>('search')

  return (
    <div className="app-layout">
      <Header title="Reserva de Vuelos" />

      <nav className="navigation">
        <button onClick={() => setPage('search')} className={page === 'search' ? 'active' : ''}>
          Buscar
        </button>
        <button onClick={() => setPage('admin-login')} className={page === 'admin-login' ? 'active' : ''}>
          Admin
        </button>
      </nav>

      <main className="main-content">
        {page === 'search' && <SearchPage />}
        {page === 'map' && <MapPage />}
        {page === 'checkout' && <CheckoutPage />}
        {page === 'booking' && <BookingPage />}
        {page === 'admin-login' && <AdminLoginPage />}
        {page === 'admin-dashboard' && <AdminDashboardPage />}
      </main>
    </div>
  )
}

function SearchPage() {
  return <div>Search Page - Coming Soon</div>
}

function MapPage() {
  return <div>Seat Map - Coming Soon</div>
}

function CheckoutPage() {
  return <div>Checkout - Coming Soon</div>
}

function BookingPage() {
  return <div>Booking - Coming Soon</div>
}

function AdminLoginPage() {
  return <div>Admin Login - Coming Soon</div>
}

function AdminDashboardPage() {
  return <div>Admin Dashboard - Coming Soon</div>
}
