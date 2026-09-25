import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FlightStatus, SeatStatus } from '@flight-reservations/shared'
import type { FlightDTO } from '@flight-reservations/shared'
import App from '../../../src/App'
import { loginAdmin, logoutAdmin } from '../../../src/features/admin/adminSession'
import { bogotaDate } from '../../../src/lib/format'
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

import { api } from '../../../src/api/client'

const flight = (overrides: Partial<FlightDTO> = {}): FlightDTO => ({
  id: 'f1',
  code: 'AV101',
  origin: 'BOG',
  destination: 'MDE',
  departureAt: '2026-09-25T11:30:00.000Z',
  arrivalAt: '2026-09-25T12:50:00.000Z',
  price: 412_000,
  currency: 'COP',
  status: FlightStatus.ON_SALE,
  version: 0,
  availableSeats: 30,
  totalSeats: 48,
  ...overrides
})

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>
  )
}

const searchMock = vi.mocked(api.flights.search)

beforeEach(() => {
  FakeEventSource.reset()
  logoutAdmin()
  sessionStorage.clear()
  loginAdmin('admin', 'admin')
  vi.mocked(api.airports.list).mockResolvedValue([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' },
    { code: 'CLO', name: 'Alfonso Bonilla Aragón', city: 'Cali', timezone: 'America/Bogota' }
  ])
  searchMock.mockReset()
  searchMock.mockResolvedValue([flight()])
  vi.mocked(api.flights.seatSnapshot).mockResolvedValue({
    flight: flight(),
    serverTime: new Date().toISOString(),
    counts: { available: 30, blocked: 0, reserved: 18, total: 48 },
    seats: [{ seatNumber: '1A', status: SeatStatus.AVAILABLE, mine: false, version: 0 }]
  })
  vi.mocked(api.admin.lockStages).mockResolvedValue({ flightId: 'f1', selecting: 0, checkout: 0 })
})

describe('/admin/dashboard', () => {
  it('looks like the public search: the same form and the same flight cards', async () => {
    renderAt('/admin/dashboard')

    expect(await screen.findByText('AV 101')).toBeInTheDocument()
    expect(screen.getByLabelText('Origen')).toHaveValue('BOG')
    expect(screen.getByLabelText('Destino')).toHaveValue('MDE')
    expect(screen.getByLabelText('Fecha')).toHaveValue(bogotaDate(1))
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument()
    expect(screen.getByText('30 de 48 libres')).toBeInTheDocument()
    expect(screen.getByText('En venta')).toBeInTheDocument()
    expect(screen.getByText(/412\.000/)).toBeInTheDocument()
    expect(screen.getByText('06:30 – 07:50')).toBeInTheDocument()
  })

  it('runs the default search on arrival, like the home page', async () => {
    renderAt('/admin/dashboard')
    await screen.findByText('AV 101')
    expect(searchMock).toHaveBeenCalledWith('BOG', 'MDE', bogotaDate(1), expect.any(AbortSignal))
  })

  it('each result offers "Ver dashboard" and never the customer\'s "Ver asientos"', async () => {
    renderAt('/admin/dashboard')
    expect(await screen.findByRole('button', { name: 'Ver dashboard, vuelo AV 101' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Ver asientos/ })).not.toBeInTheDocument()
  })

  it('every flight can be opened, whatever its status: its numbers stay visible', async () => {
    searchMock.mockResolvedValue([
      flight({ id: 'a', code: 'AV101' }),
      flight({ id: 'b', code: 'AV102', status: FlightStatus.SOLD_OUT, availableSeats: 0 }),
      flight({ id: 'c', code: 'AV103', status: FlightStatus.CANCELLED, availableSeats: 0 }),
      flight({ id: 'd', code: 'AV104', availableSeats: 0 })
    ])
    renderAt('/admin/dashboard')
    await screen.findByText('AV 101')

    for (const code of ['AV 101', 'AV 102', 'AV 103', 'AV 104']) {
      expect(screen.getByRole('button', { name: `Ver dashboard, vuelo ${code}` })).toBeEnabled()
    }
    // The statuses still show, but nothing is dimmed and no customer-facing reason is given
    expect(screen.getByText('Vendido')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText('Sin asientos por ahora')).toBeInTheDocument()
    expect(document.querySelector('.flight-card--unavailable')).toBeNull()
    expect(screen.queryByText(/Todos los asientos fueron vendidos|Este vuelo fue cancelado/)).not.toBeInTheDocument()
  })

  it('"Ver dashboard" opens that flight\'s dashboard', async () => {
    renderAt('/admin/dashboard')
    fireEvent.click(await screen.findByRole('button', { name: 'Ver dashboard, vuelo AV 101' }))

    expect(await screen.findByRole('heading', { level: 1, name: /AV 101/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a la búsqueda' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Origen')).not.toBeInTheDocument()
  })

  it('keeps the search in the URL, so coming back restores it', async () => {
    renderAt(`/admin/dashboard?origin=BOG&destination=CLO&date=${bogotaDate(2)}`)
    await screen.findByText('AV 101')
    expect(searchMock).toHaveBeenCalledWith('BOG', 'CLO', bogotaDate(2), expect.any(AbortSignal))
    expect(screen.getByLabelText('Destino')).toHaveValue('CLO')
  })

  it('validates like the public search', async () => {
    renderAt(`/admin/dashboard?origin=BOG&destination=BOG&date=${bogotaDate(1)}`)
    expect(await screen.findByText('El origen y el destino deben ser distintos')).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('shows the same empty state', async () => {
    searchMock.mockResolvedValue([])
    renderAt('/admin/dashboard')
    expect(await screen.findByText(/No hay vuelos para esa búsqueda/)).toBeInTheDocument()
  })

  it('reacts live to flight.updated: a cancellation shows without a reload', async () => {
    renderAt('/admin/dashboard')
    await screen.findByText('AV 101')

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('flight.updated', {
        type: 'flight.updated',
        flightId: 'f1',
        status: FlightStatus.CANCELLED,
        availableSeats: 0,
        version: 3
      })
    })

    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver dashboard, vuelo AV 101' })).toBeEnabled()
  })

  it('has the admin header, not the public one', async () => {
    renderAt('/admin/dashboard')
    await screen.findByText('AV 101')
    expect(screen.getByText('Panel administrativo')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('is guarded: without a session it goes to the login and comes back after signing in', async () => {
    logoutAdmin()
    renderAt('/admin/dashboard')
    expect(screen.getByRole('heading', { name: 'Acceso administrativo' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('button', { name: 'Ver dashboard, vuelo AV 101' })).toBeInTheDocument()
  })
})
