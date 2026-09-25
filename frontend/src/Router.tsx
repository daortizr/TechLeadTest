import { useState } from 'react'
import Header from './components/Header'
import SearchPageComponent from './features/flights/SearchPage'
import SeatMapPageComponent from './features/seat-map/SeatMapPage'
import CheckoutPageComponent from './features/checkout/CheckoutPage'
import BookingPageComponent from './features/booking/BookingPage'
import AdminLoginPageComponent from './features/admin/AdminLoginPage'
import AdminDashboardPageComponent from './features/admin/AdminDashboardPage'
import './styles/Router.css'

type Page = 'search' | 'map' | 'checkout' | 'booking' | 'admin-login' | 'admin-dashboard'

export default function Router() {
  const [currentPage, setCurrentPage] = useState<Page>('search')
  const [selectedFlightId, setSelectedFlightId] = useState<string>('')
  const [selectedSeat, setSelectedSeat] = useState<string>('')
  const [adminLoggedIn, setAdminLoggedIn] = useState(false)
  const [reservationCode, setReservationCode] = useState<string>('')

  const handleSelectFlight = (flightId: string) => {
    setSelectedFlightId(flightId)
    setCurrentPage('map')
  }

  const handleCheckout = (seat: string) => {
    setSelectedSeat(seat)
    setCurrentPage('checkout')
  }

  const handleCheckoutSuccess = (code: string) => {
    setReservationCode(code)
    setCurrentPage('booking')
  }

  const handleAdminLogin = () => {
    setAdminLoggedIn(true)
    setCurrentPage('admin-dashboard')
  }

  const handleAdminLogout = () => {
    setAdminLoggedIn(false)
    sessionStorage.removeItem('admin-logged-in')
    setCurrentPage('search')
  }

  return (
    <div className="app-layout">
      <Header title="Reserva de Vuelos" />

      <nav className="navigation">
        <button
          onClick={() => setCurrentPage('search')}
          className={currentPage === 'search' || currentPage === 'map' ? 'active' : ''}
        >
          Buscar
        </button>
        <button
          onClick={() => setCurrentPage('admin-login')}
          className={currentPage === 'admin-login' || currentPage === 'admin-dashboard' ? 'active' : ''}
        >
          Admin
        </button>
      </nav>

      <main className="main-content">
        {currentPage === 'search' && (
          <SearchPageComponent onSelectFlight={handleSelectFlight} />
        )}
        {currentPage === 'map' && (
          <SeatMapPageComponent
            flightId={selectedFlightId}
            onBackClick={() => setCurrentPage('search')}
            onCheckout={handleCheckout}
          />
        )}
        {currentPage === 'checkout' && (
          <CheckoutPageComponent
            flightId={selectedFlightId}
            seat={selectedSeat}
            onBack={() => setCurrentPage('map')}
            onSuccess={handleCheckoutSuccess}
          />
        )}
        {currentPage === 'booking' && (
          <BookingPageComponent
            code={reservationCode}
            onBackClick={() => setCurrentPage('search')}
          />
        )}
        {currentPage === 'admin-login' && !adminLoggedIn && (
          <AdminLoginPageComponent onLoginSuccess={handleAdminLogin} />
        )}
        {currentPage === 'admin-dashboard' && adminLoggedIn && (
          <AdminDashboardPageComponent onLogout={handleAdminLogout} />
        )}
      </main>
    </div>
  )
}
