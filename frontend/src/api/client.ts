import type {
  AirportDTO,
  CheckoutDTO,
  ErrorResponse,
  FlightDTO,
  LockDTO,
  LockStagesDTO,
  PassengerDTO,
  PaymentDTO,
  ReservationDTO,
  SeatSnapshotDTO
} from '@flight-reservations/shared'

// Relative base: the browser talks to a single origin, so there is no CORS
export const API_BASE: string = import.meta.env.VITE_API_URL || '/api'

const ADMIN_KEY: string = import.meta.env.VITE_ADMIN_KEY || ''

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  clientId?: string
  idempotencyKey?: string
  admin?: boolean
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.clientId) headers['X-Client-Id'] = options.clientId
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  if (options.admin) headers['X-Admin-Key'] = ADMIN_KEY

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK', 'No pudimos conectar con el servidor')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (payload as ErrorResponse | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Ocurrió un error inesperado',
      error?.details
    )
  }

  return payload as T
}

export interface CreateReservationInput {
  flightId: string
  seat: string
  passenger: PassengerDTO
  payment: PaymentDTO
}

export const api = {
  airports: {
    list: (signal?: AbortSignal): Promise<AirportDTO[]> => request<AirportDTO[]>('/airports', { signal })
  },

  flights: {
    search: (origin: string, destination: string, date: string, signal?: AbortSignal): Promise<FlightDTO[]> => {
      const query = new URLSearchParams({ origin, destination, date })
      return request<FlightDTO[]>(`/flights?${query.toString()}`, { signal })
    },
    seatSnapshot: (flightId: string, clientId?: string, signal?: AbortSignal): Promise<SeatSnapshotDTO> =>
      request<SeatSnapshotDTO>(`/flights/${flightId}/seats`, { clientId, signal })
  },

  seats: {
    lock: (flightId: string, seat: string, clientId: string): Promise<LockDTO> =>
      request<LockDTO>(`/flights/${flightId}/seats/${seat}/lock`, { method: 'POST', clientId }),
    unlock: (flightId: string, seat: string, clientId: string): Promise<void> =>
      request<void>(`/flights/${flightId}/seats/${seat}/lock`, { method: 'DELETE', clientId }),
    checkout: (flightId: string, seat: string, clientId: string): Promise<CheckoutDTO> =>
      request<CheckoutDTO>(`/flights/${flightId}/seats/${seat}/checkout`, { method: 'POST', clientId })
  },

  reservations: {
    create: (input: CreateReservationInput, clientId: string, idempotencyKey: string): Promise<ReservationDTO> =>
      request<ReservationDTO>('/reservations', { method: 'POST', body: input, clientId, idempotencyKey }),
    getByCode: (code: string, signal?: AbortSignal): Promise<ReservationDTO> =>
      request<ReservationDTO>(`/reservations/${encodeURIComponent(code)}`, { signal })
  },

  admin: {
    cancelFlight: (flightId: string): Promise<FlightDTO> =>
      request<FlightDTO>(`/admin/flights/${flightId}/cancel`, { method: 'POST', admin: true }),
    lockStages: (flightId: string, signal?: AbortSignal): Promise<LockStagesDTO> =>
      request<LockStagesDTO>(`/admin/flights/${flightId}/lock-stages`, { admin: true, signal })
  }
}
