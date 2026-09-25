import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FlightStatus, SeatStatus } from '@flight-reservations/shared'
import type { FlightDTO, SeatDTO, SeatSnapshotDTO } from '@flight-reservations/shared'
import { ApiError } from '../../../src/api/client'
import { AppLayout } from '../../../src/components'
import { StoreProvider } from '../../../src/realtime'
import SeatMapPage from '../../../src/features/seat/SeatMapPage'
import { FakeEventSource } from '../../setup'

vi.mock('../../../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/client')>()
  return {
    ...original,
    api: {
      airports: { list: vi.fn() },
      flights: { seatSnapshot: vi.fn() },
      seats: { lock: vi.fn(), unlock: vi.fn(), checkout: vi.fn() }
    }
  }
})

import { api } from '../../../src/api/client'

const FLIGHT_ID = '8b8ac4d2-3e44-4c7d-900d-50c2a42bef93'
const inSeconds = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString()

const flight = (overrides: Partial<FlightDTO> = {}): FlightDTO => ({
  id: FLIGHT_ID,
  code: 'AV101',
  origin: 'BOG',
  destination: 'MDE',
  departureAt: inSeconds(86_400),
  arrivalAt: inSeconds(90_000),
  priceCents: 41_200_000,
  currency: 'COP',
  status: FlightStatus.ON_SALE,
  version: 0,
  availableSeats: 9,
  totalSeats: 12,
  ...overrides
})

// Two rows of A-F. Overrides are keyed by seat number.
function snapshot(
  seatOverrides: Record<string, Partial<SeatDTO>> = {},
  flightOverrides: Partial<FlightDTO> = {}
): SeatSnapshotDTO {
  const seats: SeatDTO[] = ['1', '2'].flatMap((row) =>
    ['A', 'B', 'C', 'D', 'E', 'F'].map((column) => ({
      seatNumber: `${row}${column}`,
      status: SeatStatus.AVAILABLE,
      mine: false,
      version: 0,
      ...seatOverrides[`${row}${column}`]
    }))
  )
  return {
    flight: flight(flightOverrides),
    serverTime: new Date().toISOString(),
    counts: { available: 0, blocked: 0, reserved: 0, total: seats.length },
    seats
  }
}

const snapshotMock = vi.mocked(api.flights.seatSnapshot)
const lockMock = vi.mocked(api.seats.lock)
const unlockMock = vi.mocked(api.seats.unlock)
const checkoutMock = vi.mocked(api.seats.checkout)

function renderPage(url = `/flights/${FLIGHT_ID}`) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <StoreProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<p>Búsqueda</p>} />
            <Route path="/flights/:flightId" element={<SeatMapPage />} />
            <Route path="/flights/:flightId/checkout" element={<p>Pantalla de pago</p>} />
          </Route>
        </Routes>
      </StoreProvider>
    </MemoryRouter>
  )
}

const seat = (number: string, state: string) => screen.getByRole('button', { name: `Asiento ${number}, ${state}` })

beforeEach(() => {
  FakeEventSource.reset()
  snapshotMock.mockReset()
  lockMock.mockReset()
  unlockMock.mockReset()
  checkoutMock.mockReset()
  vi.mocked(api.airports.list).mockResolvedValue([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' }
  ])
  snapshotMock.mockResolvedValue(snapshot())
})

describe('SeatMapPage: display', () => {
  it('shows the flight, the legend, the seats in blocks around the aisle and the empty selection', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: /AV 101 · Bogotá a Medellín/ })).toBeInTheDocument()
    expect(screen.getByText('Libre')).toBeInTheDocument()
    expect(screen.getByText('Tu asiento')).toBeInTheDocument()
    expect(screen.getByText('Otro usuario')).toBeInTheDocument()
    expect(screen.getByText('Ocupado')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Asiento / })).toHaveLength(12)
    expect(screen.getByText('Sin asiento')).toBeInTheDocument()
    expect(screen.getByText('Elige un asiento libre')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeDisabled()
  })

  it('describes every seat state in words, not only by color', async () => {
    snapshotMock.mockResolvedValue(
      snapshot({
        '1A': { status: SeatStatus.RESERVED },
        '1B': { status: SeatStatus.BLOCKED, lockedUntil: inSeconds(200) }
      })
    )
    renderPage()
    await screen.findByRole('heading')

    expect(seat('1A', 'ocupado')).toHaveAttribute('aria-disabled', 'true')
    expect(seat('1B', 'bloqueado por otro usuario')).toHaveAttribute('aria-disabled', 'true')
    expect(seat('1C', 'libre')).toHaveAttribute('aria-disabled', 'false')
  })

  it('counts free, blocked and sold seats live, treating an expired lock as free', async () => {
    snapshotMock.mockResolvedValue(
      snapshot({
        '1A': { status: SeatStatus.RESERVED },
        '1B': { status: SeatStatus.RESERVED },
        '1C': { status: SeatStatus.BLOCKED, lockedUntil: inSeconds(200) },
        '1D': { status: SeatStatus.BLOCKED, lockedUntil: inSeconds(-30) }
      })
    )
    renderPage()
    await screen.findByRole('heading')

    const panel = screen.getByRole('region', { name: 'Ocupación en vivo' })
    expect(within(panel).getByText('Libres').nextSibling).toHaveTextContent('9')
    expect(within(panel).getByText('Bloqueados').nextSibling).toHaveTextContent('1')
    expect(within(panel).getByText('Ocupados').nextSibling).toHaveTextContent('2')
    expect(seat('1D', 'libre')).toBeInTheDocument()
  })

  it('shows a loading state, then the map', async () => {
    let finish: (value: SeatSnapshotDTO) => void = () => undefined
    snapshotMock.mockReturnValue(new Promise<SeatSnapshotDTO>((resolve) => (finish = resolve)))
    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando el mapa de asientos…' })).toBeInTheDocument()
    await act(async () => finish(snapshot()))
    expect(await screen.findByRole('heading', { name: /AV 101/ })).toBeInTheDocument()
  })

  it('says so when the flight does not exist', async () => {
    snapshotMock.mockRejectedValue(new ApiError(404, 'FLIGHT_NOT_FOUND', 'Vuelo no encontrado'))
    renderPage()
    expect(await screen.findByText('No encontramos este vuelo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la búsqueda' })).toBeInTheDocument()
  })

  it('shows a load error and retries', async () => {
    snapshotMock.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'No pudimos conectar con el servidor'))
    renderPage()

    expect(await screen.findByText('No pudimos cargar el mapa de asientos.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: /AV 101/ })).toBeInTheDocument()
  })
})

describe('SeatMapPage: selecting a seat', () => {
  it('locks the pressed seat and shows it as mine, with its price and a countdown', async () => {
    lockMock.mockResolvedValue({ seat: '1A', lockedUntil: inSeconds(300), version: 1 })
    renderPage()
    await screen.findByRole('heading')

    fireEvent.click(seat('1A', 'libre'))

    expect(await screen.findByRole('button', { name: 'Asiento 1A, tu asiento' })).toHaveAttribute('aria-pressed', 'true')
    expect(lockMock).toHaveBeenCalledWith(FLIGHT_ID, '1A', expect.any(String))
    const panel = screen.getByRole('region', { name: 'Tu selección' })
    expect(within(panel).getByText('1A')).toBeInTheDocument()
    expect(within(panel).getByText(/412\.000/)).toBeInTheDocument()
    expect(within(panel).getByText('Tu asiento se libera en')).toBeInTheDocument()
    expect(within(panel).getByRole('timer')).toHaveTextContent(/^(5:00|4:5\d)$/)
    expect(within(panel).getByRole('button', { name: 'Continuar al pago' })).toBeEnabled()
  })

  it('moving to another seat frees the previous one at once', async () => {
    lockMock.mockResolvedValueOnce({ seat: '1A', lockedUntil: inSeconds(300), version: 1 })
    lockMock.mockResolvedValueOnce({ seat: '2B', lockedUntil: inSeconds(300), version: 1 })
    renderPage()
    await screen.findByRole('heading')

    fireEvent.click(seat('1A', 'libre'))
    await screen.findByRole('button', { name: 'Asiento 1A, tu asiento' })
    fireEvent.click(seat('2B', 'libre'))

    expect(await screen.findByRole('button', { name: 'Asiento 2B, tu asiento' })).toBeInTheDocument()
    expect(seat('1A', 'libre')).toBeInTheDocument()
  })

  it('pressing my own seat again gives it up', async () => {
    lockMock.mockResolvedValue({ seat: '1A', lockedUntil: inSeconds(300), version: 1 })
    unlockMock.mockResolvedValue(undefined)
    renderPage()
    await screen.findByRole('heading')
    fireEvent.click(seat('1A', 'libre'))
    fireEvent.click(await screen.findByRole('button', { name: 'Asiento 1A, tu asiento' }))

    expect(await screen.findByText('Sin asiento')).toBeInTheDocument()
    expect(unlockMock).toHaveBeenCalledWith(FLIGHT_ID, '1A', expect.any(String))
    expect(seat('1A', 'libre')).toBeInTheDocument()
  })

  it('"Liberar asiento" gives the seat up too', async () => {
    lockMock.mockResolvedValue({ seat: '1A', lockedUntil: inSeconds(300), version: 1 })
    unlockMock.mockResolvedValue(undefined)
    renderPage()
    await screen.findByRole('heading')
    fireEvent.click(seat('1A', 'libre'))
    fireEvent.click(await screen.findByRole('button', { name: 'Liberar asiento' }))

    expect(await screen.findByText('Sin asiento')).toBeInTheDocument()
  })

  it('does not call the API for a seat someone else holds or that was sold', async () => {
    snapshotMock.mockResolvedValue(
      snapshot({
        '1A': { status: SeatStatus.RESERVED },
        '1B': { status: SeatStatus.BLOCKED, lockedUntil: inSeconds(200) }
      })
    )
    renderPage()
    await screen.findByRole('heading')

    fireEvent.click(seat('1A', 'ocupado'))
    fireEvent.click(seat('1B', 'bloqueado por otro usuario'))
    expect(lockMock).not.toHaveBeenCalled()
  })

  it.each([
    ['SEAT_LOCKED', 'Ese asiento ya lo tiene otra persona.'],
    ['SEAT_RESERVED', 'Ese asiento ya fue vendido.'],
    ['FLIGHT_NOT_BOOKABLE', 'Este vuelo ya no está disponible para la venta.']
  ])('a %s answer shows a notice and reloads the real state', async (code, text) => {
    lockMock.mockRejectedValue(new ApiError(409, code, 'x'))
    renderPage()
    await screen.findByRole('heading')
    snapshotMock.mockClear()

    fireEvent.click(seat('1A', 'libre'))

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(snapshotMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sin asiento')).toBeInTheDocument()
  })

  it('a network failure shows a notice and keeps the screen as it was', async () => {
    lockMock.mockRejectedValue(new ApiError(0, 'NETWORK', 'x'))
    renderPage()
    await screen.findByRole('heading')

    fireEvent.click(seat('1A', 'libre'))
    expect(await screen.findByText(/No pudimos conectar con el servidor/)).toBeInTheDocument()
    expect(seat('1A', 'libre')).toBeInTheDocument()
  })
})

describe('SeatMapPage: continuing to payment', () => {
  it('starts checkout and opens the payment screen', async () => {
    lockMock.mockResolvedValue({ seat: '1A', lockedUntil: inSeconds(300), version: 1 })
    checkoutMock.mockResolvedValue({ lockedUntil: inSeconds(310), payableUntil: inSeconds(300), version: 2 })
    renderPage()
    await screen.findByRole('heading')
    fireEvent.click(seat('1A', 'libre'))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar al pago' }))

    expect(await screen.findByText('Pantalla de pago')).toBeInTheDocument()
    expect(checkoutMock).toHaveBeenCalledWith(FLIGHT_ID, '1A', expect.any(String))
  })

  it('an expired lock at checkout clears the selection and says so', async () => {
    lockMock.mockResolvedValue({ seat: '1A', lockedUntil: inSeconds(300), version: 1 })
    checkoutMock.mockRejectedValue(new ApiError(409, 'LOCK_EXPIRED_OR_NOT_OWNED', 'x'))
    renderPage()
    await screen.findByRole('heading')
    fireEvent.click(seat('1A', 'libre'))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar al pago' }))

    expect(await screen.findByText('Tu bloqueo venció.')).toBeInTheDocument()
    expect(screen.getByText('Sin asiento')).toBeInTheDocument()
    expect(screen.queryByText('Pantalla de pago')).not.toBeInTheDocument()
  })

  it('coming back from payment: the seat is still mine and the countdown runs to payableUntil', async () => {
    snapshotMock.mockResolvedValue(
      snapshot({
        '3A': undefined,
        '1C': {
          status: SeatStatus.BLOCKED,
          mine: true,
          lockedUntil: inSeconds(310),
          payableUntil: inSeconds(240)
        }
      })
    )
    renderPage()

    const panel = await screen.findByRole('region', { name: 'Tu selección' })
    expect(within(panel).getByText('1C')).toBeInTheDocument()
    expect(within(panel).getByText('Tiempo para pagar')).toBeInTheDocument()
    // 4:00 to pay (payableUntil), not 5:10 (lockedUntil)
    expect(within(panel).getByRole('timer')).toHaveTextContent(/^(4:00|3:5\d)$/)
    expect(within(panel).getByRole('button', { name: 'Continuar al pago' })).toBeEnabled()
  })
})

describe('SeatMapPage: countdown', () => {
  it('stands out in the last minute with text, not only color', async () => {
    snapshotMock.mockResolvedValue(
      snapshot({ '1A': { status: SeatStatus.BLOCKED, mine: true, lockedUntil: inSeconds(40) } })
    )
    renderPage()

    expect(await screen.findAllByText('Te queda 1 minuto')).not.toHaveLength(0)
    expect(document.querySelector('.countdown--warning')).not.toBeNull()
  })

  it('when it reaches zero the seat goes back to free and a notice appears', async () => {
    snapshotMock.mockResolvedValue(
      snapshot({ '1A': { status: SeatStatus.BLOCKED, mine: true, lockedUntil: inSeconds(1) } })
    )
    renderPage()
    await screen.findByRole('timer')
    // The reload that follows the expiry gets what the server reports: the seat is free again
    snapshotMock.mockResolvedValue(snapshot())

    expect(await screen.findByText('Tu bloqueo venció.', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText('Sin asiento')).toBeInTheDocument()
    expect(seat('1A', 'libre')).toBeInTheDocument()
  })
})

describe('SeatMapPage: read-only flights', () => {
  it.each([
    [FlightStatus.CANCELLED, 'Este vuelo fue cancelado. El mapa es solo de lectura.'],
    [FlightStatus.SOLD_OUT, 'Todos los asientos fueron vendidos. El mapa es solo de lectura.']
  ])('a %s flight explains itself and cannot be interacted with', async (status, text) => {
    snapshotMock.mockResolvedValue(snapshot({}, { status }))
    renderPage()

    expect(await screen.findByText(text)).toBeInTheDocument()
    fireEvent.click(seat('1A', 'libre'))
    expect(lockMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continuar al pago' })).toBeDisabled()
  })

  it('a flight that already left is read-only', async () => {
    snapshotMock.mockResolvedValue(snapshot({}, { departureAt: inSeconds(-3600) }))
    renderPage()
    expect(await screen.findByText('Este vuelo ya despegó. El mapa es solo de lectura.')).toBeInTheDocument()
  })

  it('a live flight.updated that cancels the flight makes the open map read-only', async () => {
    renderPage()
    await screen.findByRole('heading')

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('flight.updated', {
        type: 'flight.updated',
        flightId: FLIGHT_ID,
        status: FlightStatus.CANCELLED,
        availableSeats: 0,
        version: 1
      })
    })

    expect(await screen.findByText('Este vuelo fue cancelado. El mapa es solo de lectura.')).toBeInTheDocument()
  })
})

describe('SeatMapPage: live updates', () => {
  it('shows a seat locked by someone else, then sold, as the events arrive', async () => {
    renderPage()
    await screen.findByRole('heading')

    act(() => {
      const source = FakeEventSource.latest()
      source.open()
      source.emit('seat.locked', { type: 'seat.locked', flightId: FLIGHT_ID, seat: '2C', version: 1, lockedUntil: inSeconds(300) })
    })
    expect(await screen.findByRole('button', { name: 'Asiento 2C, bloqueado por otro usuario' })).toBeInTheDocument()

    act(() => {
      FakeEventSource.latest().emit('seat.reserved', { type: 'seat.reserved', flightId: FLIGHT_ID, seat: '2C', version: 2 })
    })
    expect(await screen.findByRole('button', { name: 'Asiento 2C, ocupado' })).toBeInTheDocument()
  })

  it('frees a seat when its lock is released', async () => {
    snapshotMock.mockResolvedValue(snapshot({ '2C': { status: SeatStatus.BLOCKED, lockedUntil: inSeconds(200), version: 1 } }))
    renderPage()
    await screen.findByRole('heading')

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('seat.released', { type: 'seat.released', flightId: FLIGHT_ID, seat: '2C', version: 2, reason: 'EXPIRED' })
    })
    expect(await screen.findByRole('button', { name: 'Asiento 2C, libre' })).toBeInTheDocument()
  })

  it('warns that the data may be stale while the connection is being restored', async () => {
    renderPage()
    await screen.findByRole('heading')

    act(() => FakeEventSource.latest().fail())
    expect(await screen.findByText(/Sin conexión en vivo/)).toBeInTheDocument()
  })

  it('reloads the map when the stream reconnects', async () => {
    renderPage()
    await screen.findByRole('heading')
    snapshotMock.mockClear()

    act(() => FakeEventSource.latest().open())
    expect(snapshotMock).toHaveBeenCalledTimes(1)
  })
})
