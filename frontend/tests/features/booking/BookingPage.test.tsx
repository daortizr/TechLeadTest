import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FlightStatus } from '@flight-reservations/shared'
import type { FlightDTO, ReservationDTO } from '@flight-reservations/shared'
import { ApiError } from '../../../src/api/client'
import { StoreProvider } from '../../../src/realtime'
import BookingPage from '../../../src/features/booking/BookingPage'
import { FakeEventSource } from '../../setup'

vi.mock('../../../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/client')>()
  return {
    ...original,
    api: { airports: { list: vi.fn() }, reservations: { getByCode: vi.fn() } }
  }
})

import { api } from '../../../src/api/client'

const FLIGHT_ID = '4c438a42-c0fc-4626-b04a-f5c0eef8dc5d'

const flight = (overrides: Partial<FlightDTO> = {}): FlightDTO => ({
  id: FLIGHT_ID,
  code: 'AV102',
  origin: 'BOG',
  destination: 'MDE',
  departureAt: '2026-09-25T17:00:00.000Z',
  arrivalAt: '2026-09-25T18:20:00.000Z',
  price: 389_000,
  currency: 'COP',
  status: FlightStatus.ON_SALE,
  version: 0,
  ...overrides
})

const ticket = (flightOverrides: Partial<FlightDTO> = {}): ReservationDTO => ({
  code: 'MF8BC4',
  flight: flight(flightOverrides),
  seat: '5B',
  passengerName: 'Laura Gómez Peña',
  price: 389_000,
  currency: 'COP',
  createdAt: '2026-09-25T09:00:00.000Z'
})

function renderPage(locationState?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/booking/MF8BC4', state: locationState }]}>
      <StoreProvider>
        <Routes>
          <Route path="/booking/:code" element={<BookingPage />} />
        </Routes>
      </StoreProvider>
    </MemoryRouter>
  )
}

const getMock = vi.mocked(api.reservations.getByCode)
const writeText = vi.fn()

beforeEach(() => {
  FakeEventSource.reset()
  getMock.mockReset()
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  vi.mocked(api.airports.list).mockResolvedValue([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' }
  ])
  getMock.mockResolvedValue(ticket())
})

describe('BookingPage: the ticket', () => {
  it('shows the code, the flight, the seat, the passenger name and the total paid', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Reserva confirmada' })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('MF8BC4', expect.any(AbortSignal))
    expect(screen.getByText('MF8BC4')).toBeInTheDocument()
    expect(screen.getByText('AV 102')).toBeInTheDocument()
    expect(await screen.findByText('Bogotá → Medellín')).toBeInTheDocument()
    expect(screen.getByText('Vie 25 sep · 12:00')).toBeInTheDocument()
    expect(screen.getByText('5B')).toBeInTheDocument()
    expect(screen.getByText('Laura Gómez Peña')).toBeInTheDocument()
    expect(screen.getByText(/389\.000/)).toBeInTheDocument()
  })

  it('spells the code letter by letter for screen readers', async () => {
    renderPage()
    expect(await screen.findByLabelText('M F 8 B C 4')).toHaveTextContent('MF8BC4')
  })

  it('never shows document, phone or e-mail, and has no admin action', async () => {
    renderPage()
    await screen.findByText('MF8BC4')

    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/@|\+57|documento|teléfono|correo/i)
    expect(screen.queryByRole('button', { name: /cancelaci/i })).not.toBeInTheDocument()
  })

  it('shows the ticket handed over by the payment screen at once, and refreshes it quietly', async () => {
    let finish: (value: ReservationDTO) => void = () => undefined
    getMock.mockReturnValue(new Promise<ReservationDTO>((resolve) => (finish = resolve)))
    renderPage({ reservation: ticket() })

    // No loading state: the ticket is already there
    expect(screen.getByText('MF8BC4')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando tu boleto…' })).not.toBeInTheDocument()
    await act(async () => finish(ticket()))
    expect(screen.getByText('Laura Gómez Peña')).toBeInTheDocument()
  })

  it('ignores a handed-over ticket that belongs to another code', async () => {
    getMock.mockReturnValue(new Promise<ReservationDTO>(() => undefined))
    renderPage({ reservation: { ...ticket(), code: 'ZZZZZZ' } })
    expect(screen.getByRole('status', { name: 'Cargando tu boleto…' })).toBeInTheDocument()
  })
})

describe('BookingPage: states', () => {
  it('shows a loading state while the ticket is fetched', async () => {
    let finish: (value: ReservationDTO) => void = () => undefined
    getMock.mockReturnValue(new Promise<ReservationDTO>((resolve) => (finish = resolve)))
    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando tu boleto…' })).toBeInTheDocument()
    await act(async () => finish(ticket()))
    expect(await screen.findByText('MF8BC4')).toBeInTheDocument()
  })

  it('says so when the code does not exist', async () => {
    getMock.mockRejectedValue(new ApiError(404, 'RESERVATION_NOT_FOUND', 'x'))
    renderPage()
    expect(await screen.findByText('No encontramos una reserva con ese código.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buscar vuelos' })).toBeInTheDocument()
  })

  it('shows a load error and retries', async () => {
    getMock.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
    renderPage()

    expect(await screen.findByText('No pudimos cargar tu boleto.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('MF8BC4')).toBeInTheDocument()
  })

  it('reloads the ticket when the stream reconnects', async () => {
    renderPage()
    await screen.findByText('MF8BC4')
    getMock.mockClear()

    act(() => FakeEventSource.latest().open())
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
  })
})

describe('BookingPage: cancelled flight', () => {
  it('shows a prominent notice when the flight is cancelled', async () => {
    getMock.mockResolvedValue(ticket({ status: FlightStatus.CANCELLED, version: 3 }))
    renderPage()

    expect(await screen.findByText('Este vuelo fue cancelado')).toBeInTheDocument()
    expect(screen.getByText(/Tu reserva sigue registrada/)).toBeInTheDocument()
  })

  it('shows no notice while the flight is on sale', async () => {
    renderPage()
    await screen.findByText('MF8BC4')
    expect(screen.queryByText('Este vuelo fue cancelado')).not.toBeInTheDocument()
  })

  it('the notice appears live if the flight is cancelled while the ticket is open', async () => {
    renderPage()
    await screen.findByText('MF8BC4')

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('flight.updated', {
        type: 'flight.updated',
        flightId: FLIGHT_ID,
        status: FlightStatus.CANCELLED,
        availableSeats: 0,
        version: 4
      })
    })

    expect(await screen.findByText('Este vuelo fue cancelado')).toBeInTheDocument()
  })
})

describe('BookingPage: copying', () => {
  it('copies the code and confirms it', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar código' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('MF8BC4'))
    expect(await screen.findByText('Código copiado')).toBeInTheDocument()
  })

  it('copies the link to this ticket and confirms it', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar enlace' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/booking/MF8BC4`))
    expect(await screen.findByText('Enlace copiado')).toBeInTheDocument()
  })

  it('says so when the browser refuses to copy', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    document.execCommand = vi.fn().mockReturnValue(false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar código' }))

    expect(await screen.findByText(/No pudimos copiar/)).toBeInTheDocument()
    warn.mockRestore()
  })

  it('the confirmation goes away by itself', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar código' }))
    await screen.findByText('Código copiado')

    await waitFor(() => expect(screen.queryByText('Código copiado')).not.toBeInTheDocument(), { timeout: 4000 })
  })
})
