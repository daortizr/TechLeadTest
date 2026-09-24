import { useState } from 'react'
import { useStore } from '../../realtime'
import { api } from '../../api/client'
import { getClientId } from '../../lib/clientId'
import { FlightDTO } from '@flight-reservations/shared'
import { formatPrice } from '../../lib/format'
import { Button } from '../../components'
import './CheckoutPage.css'

interface CheckoutPageProps {
  flightId: string
  seat: string
  onBack: () => void
  onSuccess: (reservationCode: string) => void
}

export default function CheckoutPage({ flightId, seat, onBack, onSuccess }: CheckoutPageProps): React.ReactElement {
  const { state } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
    email: ''
  })

  const flight: FlightDTO | undefined = state.flights[flightId]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const clientId = getClientId()
      const result = await api.reservations.create({
        flightId,
        seatNumber: seat,
        email: paymentData.email,
        clientId
      })

      if (result.code) {
        onSuccess(result.code)
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago')
    } finally {
      setLoading(false)
    }
  }

  if (!flight) {
    return <div>Cargando...</div>
  }

  return (
    <div className="checkout-page">
      <div className="checkout-header">
        <Button onClick={onBack} variant="secondary">
          ← Volver
        </Button>
        <h1>Confirmación de Pago</h1>
      </div>

      <div className="checkout-container">
        <div className="order-summary">
          <h2>Resumen de la Reserva</h2>

          <div className="summary-item">
            <span>Vuelo:</span>
            <strong>{flight.code}</strong>
          </div>

          <div className="summary-item">
            <span>Ruta:</span>
            <strong>{flight.origin} → {flight.destination}</strong>
          </div>

          <div className="summary-item">
            <span>Asiento:</span>
            <strong>{seat}</strong>
          </div>

          <div className="summary-item">
            <span>Precio:</span>
            <strong>{formatPrice(flight.priceCents, flight.currency)}</strong>
          </div>

          <div className="summary-total">
            <span>Total:</span>
            <strong>{formatPrice(flight.priceCents, flight.currency)}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <h2>Datos de Pago</h2>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              value={paymentData.email}
              onChange={(e) => setPaymentData({ ...paymentData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cardName">Nombre en la Tarjeta</label>
            <input
              id="cardName"
              type="text"
              value={paymentData.cardName}
              onChange={(e) => setPaymentData({ ...paymentData, cardName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cardNumber">Número de Tarjeta</label>
            <input
              id="cardNumber"
              type="text"
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              value={paymentData.cardNumber}
              onChange={(e) =>
                setPaymentData({ ...paymentData, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16) })
              }
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expiryDate">Vencimiento</label>
              <input
                id="expiryDate"
                type="text"
                placeholder="MM/AA"
                maxLength={5}
                value={paymentData.expiryDate}
                onChange={(e) => setPaymentData({ ...paymentData, expiryDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="cvv">CVV</label>
              <input
                id="cvv"
                type="text"
                placeholder="123"
                maxLength={3}
                value={paymentData.cvv}
                onChange={(e) => setPaymentData({ ...paymentData, cvv: e.target.value.replace(/\D/g, '') })}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? 'Procesando...' : `Completar Pago ${formatPrice(flight.priceCents, flight.currency)}`}
          </Button>
        </form>
      </div>
    </div>
  )
}
