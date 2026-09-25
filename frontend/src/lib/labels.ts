import { FlightStatus } from '@flight-reservations/shared'
import type { ConnectionState } from '../realtime/types'

// Every user-facing text for a status lives here; identifiers elsewhere stay in English.

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: 'Conectando…',
  live: 'En vivo',
  reconnecting: 'Reconectando…'
}

export const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  [FlightStatus.ON_SALE]: 'En venta',
  [FlightStatus.SOLD_OUT]: 'Vendido',
  [FlightStatus.CANCELLED]: 'Cancelado'
}

export const NO_SEATS_NOW_LABEL = 'Sin asientos por ahora'

export const SEARCH_LABELS = {
  origin: 'Origen',
  destination: 'Destino',
  date: 'Fecha',
  submit: 'Buscar',
  submitting: 'Buscando…',
  viewSeats: 'Ver asientos',
  soldOutAction: 'Agotado',
  unavailableAction: 'No disponible',
  sameAirports: 'El origen y el destino deben ser distintos',
  pastDate: 'La fecha no puede ser anterior a hoy',
  missingDate: 'Elige una fecha',
  noResults: 'No hay vuelos para esa búsqueda. Prueba con otra fecha o ruta.',
  loadingAirports: 'Cargando aeropuertos…',
  airportsError: 'No pudimos cargar los aeropuertos.',
  retry: 'Reintentar'
} as const

// Why a flight cannot be booked, shown next to the disabled action
export function unavailableReason(status: FlightStatus, availableSeats: number): string | null {
  if (status === FlightStatus.SOLD_OUT) return 'Todos los asientos fueron vendidos'
  if (status === FlightStatus.CANCELLED) return 'Este vuelo fue cancelado'
  if (availableSeats === 0) return 'Hay asientos bloqueados ahora mismo; vuelve a intentarlo en unos minutos'
  return null
}

export function flightsFoundLabel(count: number): string {
  return count === 1 ? '1 vuelo encontrado' : `${count} vuelos encontrados`
}

export function seatsLabel(available: number, total: number): string {
  return `${available} de ${total} libres`
}

// ---- Seat map ----

export const SEAT_LABELS = {
  back: 'Volver a la búsqueda',
  legend: {
    free: 'Libre',
    mine: 'Tu asiento',
    other: 'Otro usuario',
    taken: 'Ocupado'
  },
  // Spoken description of each seat state (the visual states also carry an icon)
  stateOf: {
    AVAILABLE: 'libre',
    MINE: 'tu asiento',
    BLOCKED_BY_OTHER: 'bloqueado por otro usuario',
    RESERVED: 'ocupado'
  },
  selection: 'Tu selección',
  noSeat: 'Sin asiento',
  chooseSeat: 'Elige un asiento libre',
  continueToPayment: 'Continuar al pago',
  release: 'Liberar asiento',
  selectingCountdown: 'Tu asiento se libera en',
  payingCountdown: 'Tiempo para pagar',
  occupancy: 'Ocupación en vivo',
  available: 'Libres',
  blocked: 'Bloqueados',
  reserved: 'Ocupados',
  loading: 'Cargando el mapa de asientos…',
  flightNotFound: 'No encontramos este vuelo.',
  loadError: 'No pudimos cargar el mapa de asientos.',
  retry: 'Reintentar',
  stale: 'Sin conexión en vivo: los asientos pueden estar desactualizados.',
  readOnly: {
    CANCELLED: 'Este vuelo fue cancelado. El mapa es solo de lectura.',
    SOLD_OUT: 'Todos los asientos fueron vendidos. El mapa es solo de lectura.',
    DEPARTED: 'Este vuelo ya despegó. El mapa es solo de lectura.'
  },
  notices: {
    taken: 'Ese asiento ya lo tiene otra persona.',
    sold: 'Ese asiento ya fue vendido.',
    notBookable: 'Este vuelo ya no está disponible para la venta.',
    lockExpired: 'Tu bloqueo venció.',
    network: 'No pudimos conectar con el servidor. Inténtalo de nuevo.',
    generic: 'No pudimos completar la acción. Inténtalo de nuevo.'
  }
} as const

export function seatAriaLabel(seat: string, stateLabel: string): string {
  return `Asiento ${seat}, ${stateLabel}`
}

// ---- Checkout ----

export const CHECKOUT_LABELS = {
  passengerTitle: 'Datos del pasajero',
  cardTitle: 'Tarjeta (simulada)',
  summaryTitle: 'Resumen',
  fields: {
    fullName: { label: 'Nombre completo', placeholder: 'Como aparece en tu documento' },
    email: { label: 'Correo', placeholder: 'nombre@correo.com' },
    phone: { label: 'Teléfono', placeholder: '+57' },
    documentType: { label: 'Tipo de documento' },
    documentNumber: { label: 'Número de documento', placeholder: '1234567890' },
    holderName: { label: 'Titular', placeholder: 'Nombre en la tarjeta' },
    cardNumber: { label: 'Número de tarjeta', placeholder: '0000 0000 0000 0000' },
    expiry: { label: 'Vencimiento', placeholder: 'MM/AA' },
    cvv: { label: 'CVV', placeholder: '123' }
  },
  documentTypes: { CC: 'CC', CE: 'CE', PASSPORT: 'Pasaporte' },
  seat: 'Asiento',
  fare: 'Tarifa',
  total: 'Total',
  countdownBefore: 'Tienes',
  countdownAfter: 'para pagar',
  submit: 'Pagar y confirmar',
  submitting: 'Procesando pago…',
  backToMap: 'Volver al mapa de asientos',
  loading: 'Cargando el pago…',
  loadError: 'No pudimos cargar el pago.',
  retry: 'Reintentar',
  errors: {
    required: 'Este campo es obligatorio',
    fullName: 'Escribe tu nombre completo (2 a 80 caracteres)',
    email: 'Escribe un correo válido',
    phone: 'Usa el formato internacional, por ejemplo +573001234567',
    documentCC: 'La cédula tiene de 6 a 10 dígitos',
    documentOther: 'Usa de 5 a 15 letras o números',
    holderName: 'Escribe el nombre que aparece en la tarjeta',
    cardNumber: 'El número de tarjeta tiene 16 dígitos',
    expiryFormat: 'Usa el formato MM/AA',
    expiryPast: 'La tarjeta está vencida',
    cvv: 'El CVV tiene 3 o 4 dígitos'
  },
  formInvalid: 'Revisa los campos marcados.',
  declined: 'El pago fue rechazado.',
  inProgress: 'Tu pago sigue en curso. Espera un momento e inténtalo de nuevo.',
  gatewayDown: 'La pasarela de pago no está disponible. Inténtalo de nuevo.',
  network: 'No pudimos conectar con el servidor. Inténtalo de nuevo.',
  generic: 'No pudimos procesar el pago. Revisa los datos e inténtalo de nuevo.',
  flightCancelled: 'Este vuelo fue cancelado. No es posible pagar.',
  notices: {
    noSeat: 'Primero elige un asiento.',
    lockLost: 'Tu bloqueo venció. Elige un asiento de nuevo.',
    timeUp: 'Tu tiempo para pagar venció. El asiento volvió a estar libre.',
    notBookable: 'Este vuelo ya no está disponible para la venta.'
  }
} as const

// ---- Ticket ----

export const BOOKING_LABELS = {
  confirmed: 'Reserva confirmada',
  code: 'Código de reserva',
  flight: 'Vuelo',
  route: 'Ruta',
  date: 'Fecha',
  seat: 'Asiento',
  passenger: 'Pasajero',
  totalPaid: 'Total pagado',
  copyCode: 'Copiar código',
  copyLink: 'Copiar enlace',
  codeCopied: 'Código copiado',
  linkCopied: 'Enlace copiado',
  copyFailed: 'No pudimos copiar. Selecciónalo y cópialo a mano.',
  cancelled: 'Este vuelo fue cancelado',
  cancelledHelp: 'Tu reserva sigue registrada. Comunícate con la aerolínea para reprogramar o pedir el reembolso.',
  loading: 'Cargando tu boleto…',
  notFound: 'No encontramos una reserva con ese código.',
  loadError: 'No pudimos cargar tu boleto.',
  retry: 'Reintentar',
  search: 'Buscar vuelos'
} as const

// ---- Admin ----

export const ADMIN_LABELS = {
  login: {
    title: 'Acceso administrativo',
    subtitle: 'Solo para el equipo de operaciones',
    username: 'Usuario',
    password: 'Contraseña',
    submit: 'Ingresar',
    // One message for any failure: it never says which field was wrong
    invalid: 'Usuario o contraseña incorrectos'
  },
  nav: {
    label: 'Navegación administrativa',
    simulation: 'Simulación',
    dashboard: 'Dashboard',
    logout: 'Salir'
  },
  frame: {
    title: 'Panel administrativo'
  },
  dashboard: {
    title: 'Dashboard de ocupación',
    view: 'Ver dashboard',
    occupied: 'ocupado',
    free: 'Libres',
    blocked: 'Bloqueados',
    sold: 'Vendidos',
    total: 'Total',
    heatMap: 'Mapa de calor',
    legend: { free: 'Libre', blocked: 'Bloqueado', sold: 'Vendido' },
    stages: 'Etapa de los bloqueos',
    selecting: 'eligiendo',
    paying: 'pagando',
    stagesUnavailable: 'No pudimos actualizar las etapas de los bloqueos.',
    activity: 'Actividad reciente',
    noActivity: 'Todavía no hay actividad en este vuelo.',
    loading: 'Cargando el dashboard…',
    notFound: 'No encontramos este vuelo.',
    loadError: 'No pudimos cargar el dashboard.',
    retry: 'Reintentar',
    back: 'Volver a buscar vuelos',
    staleSince: (time: string): string => `Datos desactualizados desde las ${time}`,
    staleUnknown: 'Sin conexión en vivo: los datos pueden estar desactualizados.'
  },
  simulation: {
    title: 'Simulación de vuelos'
  }
} as const
