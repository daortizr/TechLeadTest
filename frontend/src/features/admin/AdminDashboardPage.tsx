import { useState } from 'react'
import { useStore } from '../../realtime'
import { api } from '../../api/client'
import { FlightDTO } from '@flight-reservations/shared'
import { Button } from '../../components'
import './AdminPage.css'

interface AdminDashboardPageProps {
  onLogout: () => void
}

export default function AdminDashboardPage({ onLogout }: AdminDashboardPageProps): React.ReactElement {
  const { state } = useStore()
  const [loading, setLoading] = useState<string>('')
  const [error, setError] = useState('')

  const flights: FlightDTO[] = Object.values(state.flights)

  const handleChangeFlightStatus = async (flightId: string, newStatus: string): Promise<void> => {
    setLoading(flightId)
    setError('')

    try {
      await api.flights.changeStatus(flightId, newStatus)
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado del vuelo')
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="admin-dashboard-page">
      <div className="dashboard-header">
        <h1>Panel Administrativo</h1>
        <Button onClick={onLogout} variant="secondary">
          Salir
        </Button>
      </div>

      <div className="dashboard-content">
        {error && <div className="error-message">{error}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Vuelos</h3>
            <p className="stat-number">{flights.length}</p>
          </div>

          <div className="stat-card">
            <h3>En Venta</h3>
            <p className="stat-number">{flights.filter(f => f.status === 'ON_SALE').length}</p>
          </div>

          <div className="stat-card">
            <h3>Vendidos</h3>
            <p className="stat-number">{flights.filter(f => f.status === 'SOLD_OUT').length}</p>
          </div>

          <div className="stat-card">
            <h3>Cancelados</h3>
            <p className="stat-number">{flights.filter(f => f.status === 'CANCELLED').length}</p>
          </div>
        </div>

        <div className="flights-section">
          <h2>Vuelos</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Ruta</th>
                <th>Estado</th>
                <th>Disponibles</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((flight) => (
                <tr key={flight.id}>
                  <td>{flight.code}</td>
                  <td>
                    {flight.origin} → {flight.destination}
                  </td>
                  <td>
                    <span className={`status-badge ${flight.status.toLowerCase()}`}>
                      {flight.status === 'ON_SALE'
                        ? 'En venta'
                        : flight.status === 'SOLD_OUT'
                          ? 'Vendido'
                          : 'Cancelado'}
                    </span>
                  </td>
                  <td>{flight.availableSeats || 0}</td>
                  <td>
                    <Button
                      size="sm"
                      variant={flight.status === 'ON_SALE' ? 'danger' : 'secondary'}
                      onClick={() =>
                        handleChangeFlightStatus(
                          flight.id,
                          flight.status === 'ON_SALE' ? 'CANCELLED' : 'ON_SALE'
                        )
                      }
                      disabled={loading === flight.id}
                    >
                      {loading === flight.id
                        ? 'Procesando...'
                        : flight.status === 'ON_SALE'
                          ? 'Cancelar'
                          : 'Reactivar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
