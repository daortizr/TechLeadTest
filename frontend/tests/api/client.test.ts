import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { api, ApiError, API_BASE } from '../../src/api/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lastCall(): { url: string; init: RequestInit & { headers: Record<string, string> } } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
  return { url: url as string, init: init as RequestInit & { headers: Record<string, string> } }
}

describe('API client', () => {
  it('uses a relative base so the browser talks to a single origin', () => {
    expect(API_BASE).toBe('/api')
  })

  it('searches flights with an encoded query', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await api.flights.search('BOG', 'MDE', '2026-09-25')

    const { url, init } = lastCall()
    expect(url).toBe('/api/flights?origin=BOG&destination=MDE&date=2026-09-25')
    expect(init.method).toBe('GET')
  })

  it('sends X-Client-Id on seat operations', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ seat: '1A', lockedUntil: 'x', version: 1 }))
    await api.seats.lock('f1', '1A', 'client-1')

    const { url, init } = lastCall()
    expect(url).toBe('/api/flights/f1/seats/1A/lock')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Client-Id']).toBe('client-1')
  })

  it('sends the checkout request to its own endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ lockedUntil: 'a', payableUntil: 'b', version: 2 }))
    await api.seats.checkout('f1', '1A', 'client-1')
    expect(lastCall().url).toBe('/api/flights/f1/seats/1A/checkout')
  })

  it('handles 204 No Content on unlock', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.seats.unlock('f1', '1A', 'client-1')).resolves.toBeUndefined()
    expect(lastCall().init.method).toBe('DELETE')
  })

  it('creates a reservation with the idempotency key and a JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'ABC234' }, 201))
    const input = {
      flightId: 'f1',
      seat: '1A',
      passenger: { fullName: 'Ana', email: 'a@b.co', documentType: 'CC', documentNumber: '1234567', phone: '+573001234567' },
      payment: { holderName: 'ANA', cardNumber: '4111111111111111', expiry: '12/99', cvv: '123' }
    }
    await api.reservations.create(input, 'client-1', 'key-1')

    const { url, init } = lastCall()
    expect(url).toBe('/api/reservations')
    expect(init.headers['Idempotency-Key']).toBe('key-1')
    expect(init.headers['X-Client-Id']).toBe('client-1')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual(input)
  })

  it('marks admin calls with X-Admin-Key', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ flightId: 'f1', selecting: 0, checkout: 0 }))
    await api.admin.lockStages('f1')
    expect(lastCall().url).toBe('/api/admin/flights/f1/lock-stages')
    expect(Object.keys(lastCall().init.headers)).toContain('X-Admin-Key')
  })

  it('does not send admin or client headers on public reads', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await api.airports.list()
    expect(lastCall().init.headers).toEqual({})
  })

  it('turns the standard error format into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'SEAT_LOCKED', message: 'Asiento bloqueado', details: { lockedUntil: 'x' } } }, 409)
    )

    const error = await api.seats.lock('f1', '1A', 'c').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, code: 'SEAT_LOCKED', message: 'Asiento bloqueado', details: { lockedUntil: 'x' } })
  })

  it('reports a non-JSON error body with a generic code', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    const error = await api.airports.list().catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN' })
  })

  it('reports a network failure as NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await api.airports.list().catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 0, code: 'NETWORK' })
  })

  it('lets an aborted request surface as an AbortError, not as a failure', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const error = await api.airports.list().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
  })

  it('encodes the reservation code in the path', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'A/B' }))
    await api.reservations.getByCode('A/B')
    expect(lastCall().url).toBe('/api/reservations/A%2FB')
  })
})
