import { Button } from '../../components'
import './BookingPage.css'

interface BookingPageProps {
  code: string
  onBackClick: () => void
}

export default function BookingPage({ code, onBackClick }: BookingPageProps): React.ReactElement {
  return (
    <div className="booking-page">
      <div className="booking-header">
        <Button onClick={onBackClick} variant="secondary">
          ← Volver
        </Button>
      </div>

      <div className="booking-container">
        <div className="confirmation-card">
          <div className="confirmation-icon">✓</div>
          <h1>¡Reserva Confirmada!</h1>
          <p className="confirmation-text">Tu reserva ha sido procesada exitosamente</p>

          <div className="booking-details">
            <div className="detail-row">
              <span className="label">Código de reserva:</span>
              <span className="value">{code}</span>
            </div>
          </div>

          <p className="confirmation-note">
            Revisa tu correo electrónico para detalles adicionales
          </p>

          <Button onClick={onBackClick}>Ir a inicio</Button>
        </div>
      </div>
    </div>
  )
}
