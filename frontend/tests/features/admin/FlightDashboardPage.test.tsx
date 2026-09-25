import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FlightStatus, SeatStatus } from '@flight-reservations/shared'
import type { SeatDTO, SeatSnapshotDTO } from '@flight-reservations/shared'
import App from '../../../src/App'
import { loginAdmin, logoutAdmin } from '../../../src/features/admin/adminSession'
import { FakeEventSource } from '../../setup'

vi.mock('../../../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/client')>()
  return {
    ...original,
    api: {
      airports: { list: vi.fn() },
      flights: { search: vi.fn(), seatSnapshot: vi.fn() },
      reservations: { getByCode: vi.fn() },
      admin: { lockStages: vi.fn(), cancelFlight: vi.fn() }
    }
  }
})

import { api, ApiError } from '../../../src/api/client'

const ID = 'f1'
const inSeconds = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString()

// 12 seats: 2 sold, 1 blocked, 9 free
function snapshot(): SeatSnapshotDTO {
  const seats: SeatDTO[] = ['1', '2'].flatMap((row) =>
    ['A', 'B', 'C', 'D', 'E', 'F'].map((column) => ({
      seatNumber: `${row}${column}`,
      status: SeatStatus.AVAILABLE,
      mine: false,
      version: 0
    }))
  )
  seats[0] = { ...seats[0], status: SeatStatus.RESERVED, version: 1 }
  seats[1] = { ...seats[1], status: SeatStatus.RESERVED, version: 1 }
  seats[2] = { ...seats[2], status: SeatStatus.BLOCKED, version: 1, lockedUntil: inSeconds(200) }
  return {
    flight: {
      id: ID,
      code: 'AV101',
      origin: 'BOG',
      destination: 'MDE',
      departureAt: inSeconds(86_400),
      arrivalAt: inSeconds(90_000),
      price: 412_000,
      currency: 'COP',
      status: FlightStatus.ON_SALE,
      version: 0,
      availableSeats: 9,
      totalSeats: 12
    },
    serverTime: new Date().toISOString(),
    counts: { available: 9, blocked: 1, reserved: 2, total: 12 },
    seats
  }
}

const snapshotMock = vi.mocked(api.flights.seatSnapshot)
const stagesMock = vi.mocked(api.admin.lockStages)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/admin/dashboard/${ID}`]}>
      <App />
    </MemoryRouter>
  )
}

beforeEach(() => {
  FakeEventSource.reset()
  logoutAdmin()
  sessionStorage.clear()
  loginAdmin('admin', 'admin')
  vi.mocked(api.airports.list).mockResolvedValue([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' }
  ])
  snapshotMock.mockReset()
  snapshotMock.mockResolvedValue(snapshot())
  stagesMock.mockReset()
  stagesMock.mockResolvedValue({ flightId: ID, selecting: 3, checkout: 4 })
})

describe('/admin/dashboard/:flightId', () => {
  it('shows occupancy, tiles, lock stages and an empty activity feed', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: /AV 101/ })).toBeInTheDocument()
    expect(screen.getByText('25% ocupado')).toBeInTheDocument()
    const tiles = document.querySelector('.dash-tiles') as HTMLElement
    expect(within(tiles).getByText('Libres').nextSibling).toHaveTextContent('9')
    expect(within(tiles).getByText('Bloqueados').nextSibling).toHaveTextContent('1')
    expect(within(tiles).getByText('Vendidos').nextSibling).toHaveTextContent('2')
    expect(within(tiles).getByText('Total').nextSibling).toHaveTextContent('12')

    expect(await screen.findByLabelText('3 eligiendo, 4 pagando')).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay actividad/)).toBeInTheDocument()
    expect(document.querySelectorAll('.heat-cell[data-seat]')).toHaveLength(12)
  })

  it('has a back button and no tab row', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'Volver a la búsqueda' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegación administrativa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salir' })).not.toBeInTheDocument()
  })

  it('requests the snapshot without a client id: the administrator holds no seats', async () => {
    renderPage()
    await screen.findByText('25% ocupado')
    expect(snapshotMock).toHaveBeenCalledWith(ID, undefined, expect.any(AbortSignal))
  })

  it('adds live events to the feed and updates the numbers', async () => {
    renderPage()
    await screen.findByText('25% ocupado')

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('seat.reserved', { type: 'seat.reserved', flightId: ID, seat: '2C', version: 2 })
    })

    expect(await screen.findByText('02C reservado')).toBeInTheDocument()
    expect(screen.getByText('ahora')).toBeInTheDocument()
  })

  it('reloads the lock stages after seat events', async () => {
    renderPage()
    await screen.findByLabelText('3 eligiendo, 4 pagando')
    stagesMock.mockResolvedValue({ flightId: ID, selecting: 1, checkout: 0 })

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('seat.locked', {
        type: 'seat.locked',
        flightId: ID,
        seat: '2D',
        version: 1,
        lockedUntil: inSeconds(300)
      })
    })

    expect(await screen.findByLabelText('1 eligiendo, 0 pagando', undefined, { timeout: 3000 })).toBeInTheDocument()
  })

  it('warns when the live connection is not up', async () => {
    renderPage()
    await screen.findByText('25% ocupado')
    expect(screen.getByText(/Sin conexión en vivo|Datos desactualizados/)).toBeInTheDocument()
  })

  it('shows a message for an unknown flight', async () => {
    snapshotMock.mockRejectedValue(new ApiError(404, 'FLIGHT_NOT_FOUND', 'x'))
    renderPage()
    expect(await screen.findByText('No encontramos este vuelo.')).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    snapshotMock.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText('No pudimos cargar el dashboard.')).toBeInTheDocument()
    snapshotMock.mockResolvedValue(snapshot())
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('25% ocupado')).toBeInTheDocument())
  })
})
