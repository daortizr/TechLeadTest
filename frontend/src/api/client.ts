import { FlightDTO, SeatSnapshotDTO, ReservationDTO, ErrorCode } from '@flight-reservations/shared'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface ApiError {
  error: {
    code: ErrorCode
    message: string
  }
}

async function fetchApi<T>(path: string, options: RequestInit & { clientId?: string; idempotencyKey?: string } = {}): Promise<T> {
  const { clientId, idempotencyKey, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  if (clientId) {
    headers['X-Client-Id'] = clientId
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw {
      status: response.status,
      ...error.error,
    }
  }

  return response.json()
}

export const api = {
  airports: {
    list: () => fetchApi<any[]>('/airports'),
  },

  flights: {
    search: (origin: string, destination: string, date: string) =>
      fetchApi<FlightDTO[]>(`/flights?origin=${origin}&destination=${destination}&date=${date}`),

    getSeatSnapshot: (flightId: string, clientId?: string) =>
      fetchApi<SeatSnapshotDTO>(`/flights/${flightId}/seats`, { clientId }),
  },

  seats: {
    lock: (flightId: string, seat: string, clientId: string) =>
      fetchApi(`/flights/${flightId}/seats/${seat}/lock`, {
        method: 'POST',
        clientId,
      }),

    unlock: (flightId: string, seat: string, clientId: string) =>
      fetchApi(`/flights/${flightId}/seats/${seat}/lock`, {
        method: 'DELETE',
        clientId,
      }),

    startCheckout: (flightId: string, seat: string, clientId: string) =>
      fetchApi(`/flights/${flightId}/seats/${seat}/checkout`, {
        method: 'POST',
        clientId,
      }),
  },

  reservations: {
    create: (
      flightId: string,
      seat: string,
      clientId: string,
      idempotencyKey: string,
      passenger: any,
      payment: any
    ) =>
      fetchApi<ReservationDTO>('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          flightId,
          seat,
          passenger,
          payment,
        }),
        clientId,
        idempotencyKey,
      }),

    getByCode: (code: string) => fetchApi<ReservationDTO>(`/reservations/${code}`),
  },
}
