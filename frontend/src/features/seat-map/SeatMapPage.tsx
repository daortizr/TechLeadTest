import { useStore } from '../../realtime'
import { getClientId } from '../../lib/clientId'
import { Button } from '../../components'
import './SeatMapPage.css'

interface SeatMapPageProps {
  flightId: string
  onBackClick: () => void
  onCheckout: (seat: string) => void
}

export default function SeatMapPage({ flightId, onBackClick, onCheckout }: SeatMapPageProps) {
  const { state } = useStore()
  const clientId = getClientId()

  const flight = state.flights[flightId]
  const seats = state.seats[flightId] || {}
  const myLock = state.myLock[flightId]

  if (!flight) {
    return <div>Cargando...</div>
  }

  const seatArray = Object.values(seats).sort((a, b) =>
    a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true })
  )

  return (
    <div className="seat-map-page">
      <div className="map-header">
        <Button onClick={onBackClick} variant="secondary">
          ← Volver
        </Button>
        <h1>{flight.code}</h1>
        <div className="flight-info">
          {flight.origin} → {flight.destination}
        </div>
      </div>

      <div className="map-container">
        <div className="seat-map">
          <div className="legend">
            <div className="legend-item">
              <div className="seat available"></div>
              <span>Disponible</span>
            </div>
            <div className="legend-item">
              <div className="seat blocked"></div>
              <span>Bloqueado</span>
            </div>
            <div className="legend-item">
              <div className="seat reserved"></div>
              <span>Vendido</span>
            </div>
            {myLock && (
              <div className="legend-item">
                <div className="seat mine"></div>
                <span>Tu asiento</span>
              </div>
            )}
          </div>

          <div className="seats-grid">
            {seatArray.map((seat) => {
              const isMine = myLock?.seat === seat.seatNumber
              const statusClass = isMine ? 'mine' : seat.status.toLowerCase()

              return (
                <button
                  key={seat.seatNumber}
                  className={`seat-button ${statusClass}`}
                  disabled={seat.status === 'RESERVED' || (seat.status === 'BLOCKED' && !isMine)}
                  title={seat.seatNumber}
                >
                  {seat.seatNumber}
                </button>
              )
            })}
          </div>
        </div>

        {myLock && (
          <div className="seat-summary">
            <h2>Tu selección</h2>
            <div className="summary-item">
              <span>Asiento:</span>
              <strong>{myLock.seat}</strong>
            </div>
            <div className="summary-item">
              <span>Vencimiento:</span>
              <strong>{new Date(myLock.lockedUntil).toLocaleTimeString()}</strong>
            </div>
            <Button onClick={() => onCheckout(myLock.seat)} className="checkout-btn">
              Proceder a pago
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
