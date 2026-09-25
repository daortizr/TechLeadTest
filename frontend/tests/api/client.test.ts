import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../../src/api/client'

// Mock fetch
global.fetch = vi.fn()

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should construct correct URL for flight search', async () => {
    const mockResponse = { ok: true, json: async () => ([]) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.flights.search('BOG', 'MDE', '2026-12-25')

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('?origin=BOG&destination=MDE&date=2026-12-25'), expect.any(Object))
  })

  it('should include clientId header when provided', async () => {
    const mockResponse = { ok: true, json: async () => ({ seats: [] }) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    const clientId = 'test-client-123'
    await api.flights.getSeatSnapshot('flight-1', clientId)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Client-Id': clientId,
        }),
      })
    )
  })

  it('should include Idempotency-Key header for reservation creation', async () => {
    const mockResponse = { ok: true, json: async () => ({ code: 'RES-001' }) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.reservations.create({
      flightId: 'flight-1',
      seatNumber: '1A',
      email: 'test@example.com',
      clientId: 'client-123',
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      })
    )
  })

  it('should handle successful response', async () => {
    const flightData = {
      id: 'flight-1',
      code: 'AV001',
      status: 'ON_SALE',
    }

    const mockResponse = { ok: true, json: async () => [flightData] }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    const result = await api.flights.search('BOG', 'MDE', '2026-12-25')

    expect(result).toEqual([flightData])
  })

  it('should throw error on failed response', async () => {
    const errorResponse = {
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          code: 'FLIGHT_NOT_FOUND',
          message: 'Flight not found',
        },
      }),
    }
    ;(global.fetch as any).mockResolvedValueOnce(errorResponse)

    await expect(api.flights.search('BOG', 'MDE', '2026-12-25')).rejects.toThrow()
  })

  it('should include correct HTTP method for lock operation', async () => {
    const mockResponse = { ok: true, json: async () => ({}) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.seats.lock('flight-1', '1A', 'client-123')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('should include correct HTTP method for unlock operation', async () => {
    const mockResponse = { ok: true, json: async () => ({}) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.seats.unlock('flight-1', '1A', 'client-123')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'DELETE',
      })
    )
  })

  it('should include correct HTTP method for flight status change', async () => {
    const mockResponse = { ok: true, json: async () => ({}) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.flights.changeStatus('flight-1', 'CANCELLED')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PATCH',
      })
    )
  })

  it('should serialize request body correctly', async () => {
    const mockResponse = { ok: true, json: async () => ({}) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.flights.changeStatus('flight-1', 'CANCELLED')

    const callArgs = (global.fetch as any).mock.calls[0][1]
    const body = JSON.parse(callArgs.body)

    expect(body).toEqual({ status: 'CANCELLED' })
  })

  it('should include Content-Type header', async () => {
    const mockResponse = { ok: true, json: async () => ({}) }
    ;(global.fetch as any).mockResolvedValueOnce(mockResponse)

    await api.flights.search('BOG', 'MDE', '2026-12-25')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
  })
})
