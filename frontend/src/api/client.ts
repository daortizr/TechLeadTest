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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (typeof fetchOptions.headers === 'object' && fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers)
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

    changeStatus: (flightId: string, status: string) =>
      fetchApi(`/flights/${flightId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
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
    create: (payload: {
      flightId: string
      seatNumber: string
      email: string
      clientId: string
    }) =>
      fetchApi<{ code: string }>('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          flightId: payload.flightId,
          seat: payload.seatNumber,
          passengerEmail: payload.email,
        }),
        clientId: payload.clientId,
        idempotencyKey: `${payload.flightId}-${payload.seatNumber}`,
      }),

    getByCode: (code: string) => fetchApi<ReservationDTO>(`/reservations/${code}`),
  },
}
