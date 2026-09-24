import { useState } from 'react'
import { api } from '../../api/client'
import { FlightDTO } from '@flight-reservations/shared'
import { formatPrice, formatDateTime } from '../../lib/format'
import { Button } from '../../components'
import './SearchPage.css'

interface SearchParams {
  origin: string
  destination: string
  date: string
}

export default function SearchPage({ onSelectFlight }: { onSelectFlight: (flightId: string) => void }): React.ReactElement {
  const [params, setParams] = useState<SearchParams>({ origin: '', destination: '', date: '' })
  const [flights, setFlights] = useState<FlightDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const results = await api.flights.search(params.origin.toUpperCase(), params.destination.toUpperCase(), params.date)
      setFlights(results)
      if (results.length === 0) {
        setError('No se encontraron vuelos para esa búsqueda')
      }
    } catch (err: any) {
      setError(err.message || 'Error al buscar vuelos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="search-page">
      <div className="search-form">
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label htmlFor="origin">Origen</label>
            <input
              id="origin"
              type="text"
              placeholder="BOG"
              maxLength={3}
              value={params.origin}
              onChange={(e) => setParams({ ...params, origin: (e.target as HTMLInputElement).value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="destination">Destino</label>
            <input
              id="destination"
              type="text"
              placeholder="MDE"
              maxLength={3}
              value={params.destination}
              onChange={(e) => setParams({ ...params, destination: (e.target as HTMLInputElement).value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="date">Fecha</label>
            <input
              id="date"
              type="date"
              value={params.date}
              onChange={(e) => setParams({ ...params, date: (e.target as HTMLInputElement).value })}
              required
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </form>
      </div>

      {error && <div className="error-message">{error}</div>}

      {flights.length > 0 && (
        <div className="flights-list">
          <h2>Vuelos disponibles</h2>
          {flights.map((flight) => (
            <div key={flight.id} className="flight-card">
              <div className="flight-header">
                <span className="flight-code">{flight.code}</span>
                <span className="route">
                  {flight.origin} → {flight.destination}
                </span>
                <span className={`status ${flight.status.toLowerCase()}`}>
                  {flight.status === 'ON_SALE' ? 'En venta' : flight.status === 'SOLD_OUT' ? 'Vendido' : 'Cancelado'}
                </span>
              </div>

              <div className="flight-details">
                <div>
                  <strong>{formatDateTime(flight.departureAt)}</strong>
                  <span>Salida</span>
                </div>
                <div>
                  <strong>{formatDateTime(flight.arrivalAt)}</strong>
                  <span>Llegada</span>
                </div>
                <div>
                  <strong>{formatPrice(flight.priceCents, flight.currency)}</strong>
                  <span>Precio</span>
                </div>
                <div>
                  <strong>{flight.availableSeats ?? 0}</strong>
                  <span>
                    {flight.status === 'SOLD_OUT'
                      ? 'Vendido'
                      : (flight.availableSeats ?? 0) === 0
                        ? 'Sin asientos'
                        : 'Asientos'}
                  </span>
                </div>
              </div>

              <div className="flight-actions">
                <Button
                  onClick={() => onSelectFlight(flight.id)}
                  disabled={flight.status !== 'ON_SALE' || (flight.availableSeats ?? 0) === 0}
                >
                  {flight.status === 'ON_SALE' && (flight.availableSeats ?? 0) > 0 ? 'Ver asientos' : 'No disponible'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
