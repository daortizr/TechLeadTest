import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FlightStatus } from '@flight-reservations/shared'
import type { AirportDTO, FlightDTO } from '@flight-reservations/shared'
import { ApiError } from '../../src/api/client'
import { StoreProvider } from '../../src/realtime'
import SearchPage from '../../src/features/flights/SearchPage'
import { bogotaDate } from '../../src/lib/format'
import { FakeEventSource } from '../setup'

vi.mock('../../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/api/client')>()
  return {
    ...original,
    api: { airports: { list: vi.fn() }, flights: { search: vi.fn() } }
  }
})

import { api } from '../../src/api/client'

const airports: AirportDTO[] = [
  { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
  { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' },
  { code: 'CLO', name: 'Alfonso Bonilla Aragón', city: 'Cali', timezone: 'America/Bogota' }
]

function flight(overrides: Partial<FlightDTO> = {}): FlightDTO {
  return {
    id: 'f1',
    code: 'AV101',
    origin: 'BOG',
    destination: 'MDE',
    departureAt: '2026-09-25T11:30:00.000Z',
    arrivalAt: '2026-09-25T12:50:00.000Z',
    priceCents: 41200000,
    currency: 'COP',
    status: FlightStatus.ON_SALE,
    version: 0,
    availableSeats: 30,
    totalSeats: 48,
    ...overrides
  }
}

function renderPage(initialUrl = '/') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <StoreProvider>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/flights/:id" element={<p>Pantalla del mapa</p>} />
        </Routes>
      </StoreProvider>
    </MemoryRouter>
  )
}

const searchMock = vi.mocked(api.flights.search)
const airportsMock = vi.mocked(api.airports.list)

beforeEach(() => {
  FakeEventSource.reset()
  searchMock.mockReset()
  airportsMock.mockReset()
  airportsMock.mockResolvedValue(airports)
  searchMock.mockResolvedValue([flight()])
})

describe('SearchPage', () => {
  it('opens with the default search Bogotá to Medellín for tomorrow and shows the results', async () => {
    searchMock.mockResolvedValue([
      flight(),
      flight({
        id: 'f2',
        code: 'AV102',
        availableSeats: 48,
        priceCents: 38900000,
        departureAt: '2026-09-25T17:00:00.000Z',
        arrivalAt: '2026-09-25T18:20:00.000Z'
      })
    ])
    renderPage()

    await screen.findByText('AV 101')
    expect(searchMock).toHaveBeenCalledWith('BOG', 'MDE', bogotaDate(1), expect.any(AbortSignal))
    expect(screen.getByText('AV 102')).toBeInTheDocument()
    expect(screen.getByText('30 de 48 libres')).toBeInTheDocument()
    expect(screen.getAllByText('En venta')).toHaveLength(2)
    expect(screen.getByText('06:30 – 07:50')).toBeInTheDocument()
    expect(screen.getByText(/2 vuelos encontrados · Bogotá a Medellín/)).toBeInTheDocument()
  })

  it('fills the airport selects with "City (CODE)"', async () => {
    renderPage()
    await screen.findByText('AV 101')
    const origin = screen.getByLabelText('Origen') as HTMLSelectElement
    expect(within(origin).getByRole('option', { name: 'Bogotá (BOG)' })).toBeInTheDocument()
    expect(origin.value).toBe('BOG')
    expect((screen.getByLabelText('Destino') as HTMLSelectElement).value).toBe('MDE')
  })

  it('restores the search from the URL, so "back" from the map keeps it', async () => {
    renderPage(`/?origin=BOG&destination=CLO&date=${bogotaDate(2)}`)
    await screen.findByText('AV 101')
    expect(searchMock).toHaveBeenCalledWith('BOG', 'CLO', bogotaDate(2), expect.any(AbortSignal))
  })

  it('goes to the seat map when "Ver asientos" is pressed', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Ver asientos, vuelo AV 101/ }))
    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
  })

  it('a sold-out flight has no action and says why, apart from a flight that is only locked for now', async () => {
    searchMock.mockResolvedValue([
      flight({ id: 'sold', code: 'AV106', status: FlightStatus.SOLD_OUT, availableSeats: 0 }),
      flight({ id: 'locked', code: 'AV107', availableSeats: 0 }),
      flight({ id: 'gone', code: 'AV108', status: FlightStatus.CANCELLED, availableSeats: 0 })
    ])
    renderPage()

    await screen.findByText('AV 106')
    expect(screen.getByText('Vendido')).toBeInTheDocument()
    expect(screen.getByText('Sin asientos por ahora')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText('Todos los asientos fueron vendidos')).toBeInTheDocument()
    expect(screen.getByText('Este vuelo fue cancelado')).toBeInTheDocument()
    expect(screen.getByText(/asientos bloqueados ahora mismo/)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Agotado, vuelo AV 106/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /No disponible, vuelo AV 107/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /No disponible, vuelo AV 108/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Ver asientos/ })).not.toBeInTheDocument()
  })

  it('validates that origin and destination differ, without calling the API', async () => {
    renderPage()
    await screen.findByText('AV 101')
    searchMock.mockClear()

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'BOG' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByRole('alert', { name: '' })).toBeTruthy()
    expect(screen.getByText('El origen y el destino deben ser distintos')).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  // Through the URL: happy-dom empties a date input whose value is below `min`, browsers do not
  it('rejects a date in the past, with a message and without calling the API', async () => {
    renderPage(`/?origin=BOG&destination=MDE&date=${bogotaDate(-1)}`)

    expect(await screen.findByText('La fecha no puede ser anterior a hoy')).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/vuelos encontrados/)).not.toBeInTheDocument()
  })

  it('rejects a link with the same origin and destination', async () => {
    renderPage(`/?origin=BOG&destination=BOG&date=${bogotaDate(1)}`)

    expect(await screen.findByText('El origen y el destino deben ser distintos')).toBeInTheDocument()
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('clears the message once a valid search runs', async () => {
    renderPage(`/?origin=BOG&destination=BOG&date=${bogotaDate(1)}`)
    await screen.findByText('El origen y el destino deben ser distintos')

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'MDE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await screen.findByText('AV 101')
    expect(screen.queryByText('El origen y el destino deben ser distintos')).not.toBeInTheDocument()
  })

  it('searches again with the new values', async () => {
    renderPage()
    await screen.findByText('AV 101')
    searchMock.mockClear()
    searchMock.mockResolvedValue([flight({ id: 'cali', code: 'AV110', destination: 'CLO' })])

    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'CLO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await screen.findByText('AV 110')
    expect(searchMock).toHaveBeenCalledWith('BOG', 'CLO', bogotaDate(1), expect.any(AbortSignal))
  })

  it('shows a message when there are no flights', async () => {
    searchMock.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/No hay vuelos para esa búsqueda/)).toBeInTheDocument()
    expect(screen.getByText(/0 vuelos encontrados/)).toBeInTheDocument()
  })

  it('shows the API error and lets the user retry', async () => {
    searchMock.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'No pudimos conectar con el servidor'))
    renderPage()

    expect(await screen.findByText('No pudimos conectar con el servidor')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('AV 101')).toBeInTheDocument()
  })

  it('blocks the form and says so while loading', async () => {
    let finish: (flights: FlightDTO[]) => void = () => undefined
    searchMock.mockReturnValue(new Promise<FlightDTO[]>((resolve) => (finish = resolve)))
    renderPage()

    const button = await screen.findByRole('button', { name: 'Buscando…' })
    expect(button).toBeDisabled()
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()

    await act(async () => finish([flight()]))
    expect(await screen.findByRole('button', { name: 'Buscar' })).toBeEnabled()
  })

  it('reacts live to flight.updated events from the stream', async () => {
    renderPage()
    await screen.findByText('AV 101')
    expect(screen.getByRole('button', { name: /Ver asientos/ })).toBeEnabled()

    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('flight.updated', {
        type: 'flight.updated',
        flightId: 'f1',
        status: FlightStatus.SOLD_OUT,
        availableSeats: 0,
        version: 1
      })
    })

    expect(await screen.findByText('Vendido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agotado/ })).toBeDisabled()
  })

  it('reloads the results quietly when the stream reconnects', async () => {
    renderPage()
    await screen.findByText('AV 101')
    searchMock.mockClear()
    searchMock.mockResolvedValue([flight({ availableSeats: 12 })])

    act(() => FakeEventSource.latest().open())

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('12 de 48 libres')).toBeInTheDocument()
    // No skeleton flash on a silent reload
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('tells the user when the airports cannot be loaded and retries', async () => {
    airportsMock.mockRejectedValueOnce(new Error('down'))
    renderPage()

    expect(await screen.findByText(/No pudimos cargar los aeropuertos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('AV 101')
  })
})
