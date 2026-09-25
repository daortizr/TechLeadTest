import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FlightStatus, SeatStatus } from '@flight-reservations/shared'
import type { FlightDTO, ReservationDTO, SeatDTO, SeatSnapshotDTO } from '@flight-reservations/shared'
import { ApiError } from '../../../src/api/client'
import { AppLayout } from '../../../src/components'
import { StoreProvider } from '../../../src/realtime'
import CheckoutPage from '../../../src/features/checkout/CheckoutPage'
import { FakeEventSource } from '../../setup'

vi.mock('../../../src/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/api/client')>()
  return {
    ...original,
    api: {
      airports: { list: vi.fn() },
      flights: { seatSnapshot: vi.fn() },
      seats: { unlock: vi.fn() },
      reservations: { create: vi.fn() }
    }
  }
})

import { api } from '../../../src/api/client'

const FLIGHT_ID = '4c438a42-c0fc-4626-b04a-f5c0eef8dc5d'
const inSeconds = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString()

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
  availableSeats: 40,
  totalSeats: 48,
  ...overrides
})

// My seat in checkout, unless told otherwise
function snapshot(mine: Partial<SeatDTO> | null = {}, flightOverrides: Partial<FlightDTO> = {}): SeatSnapshotDTO {
  const seats: SeatDTO[] = ['1A', '3C', '5B'].map((seatNumber) => ({
    seatNumber,
    status: SeatStatus.AVAILABLE,
    mine: false,
    version: 0
  }))
  if (mine) {
    seats[1] = {
      seatNumber: '3C',
      status: SeatStatus.BLOCKED,
      mine: true,
      version: 2,
      lockedUntil: inSeconds(310),
      payableUntil: inSeconds(300),
      ...mine
    }
  }
  return { flight: flight(flightOverrides), serverTime: new Date().toISOString(), counts: { available: 2, blocked: 1, reserved: 0, total: 3 }, seats }
}

const ticket = (): ReservationDTO => ({
  code: 'MF8BC4',
  flight: flight(),
  seat: '3C',
  passengerName: 'Laura Gómez Peña',
  price: 389_000,
  currency: 'COP',
  createdAt: new Date().toISOString()
})

function BookingProbe(): React.ReactElement {
  const location = useLocation()
  const state = location.state as { reservation?: ReservationDTO } | null
  return <p>Boleto {location.pathname} {state?.reservation?.code}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/flights/${FLIGHT_ID}/checkout`]}>
      <StoreProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/flights/:flightId" element={<p>Pantalla del mapa</p>} />
            <Route path="/flights/:flightId/checkout" element={<CheckoutPage />} />
            <Route path="/booking/:code" element={<BookingProbe />} />
          </Route>
        </Routes>
      </StoreProvider>
    </MemoryRouter>
  )
}

const snapshotMock = vi.mocked(api.flights.seatSnapshot)
const createMock = vi.mocked(api.reservations.create)
const unlockMock = vi.mocked(api.seats.unlock)

const VALID: Record<string, string> = {
  fullName: 'Laura Gómez Peña',
  email: ' Laura@Correo.com ',
  phone: '+57 300 123 4567',
  documentNumber: '1234567890',
  holderName: 'LAURA GOMEZ',
  cardNumber: '4111111111111111',
  expiry: '1230',
  cvv: '123'
}

function fill(overrides: Record<string, string> = {}) {
  for (const [id, value] of Object.entries({ ...VALID, ...overrides })) {
    fireEvent.change(document.getElementById(id) as HTMLElement, { target: { value } })
  }
}

const pay = () => fireEvent.click(screen.getByRole('button', { name: /Pagar y confirmar|Procesando pago/ }))
const input = (id: string) => document.getElementById(id) as HTMLInputElement

async function ready() {
  renderPage()
  await screen.findByRole('button', { name: 'Pagar y confirmar' })
}

beforeEach(() => {
  FakeEventSource.reset()
  snapshotMock.mockReset()
  createMock.mockReset()
  unlockMock.mockReset()
  unlockMock.mockResolvedValue(undefined)
  vi.mocked(api.airports.list).mockResolvedValue([
    { code: 'BOG', name: 'El Dorado', city: 'Bogotá', timezone: 'America/Bogota' },
    { code: 'MDE', name: 'José María Córdova', city: 'Medellín', timezone: 'America/Bogota' }
  ])
  snapshotMock.mockResolvedValue(snapshot())
  sessionStorage.clear()
  localStorage.clear()
})

describe('CheckoutPage: entry', () => {
  it('shows the summary of my seat and a countdown to payableUntil, never to lockedUntil', async () => {
    await ready()

    const summary = screen.getByRole('complementary')
    expect(within(summary).getByText(/AV 102 · Bogotá a Medellín/)).toBeInTheDocument()
    expect(within(summary).getByText(/Vie 25 sep · 12:00 – 13:20/)).toBeInTheDocument()
    expect(within(summary).getByText('3C')).toBeInTheDocument()
    expect(within(summary).getAllByText(/389\.000/)).toHaveLength(2) // fare and total
    // 5:00 to pay (payableUntil), not 5:10 (lockedUntil)
    expect(within(summary).getByRole('timer')).toHaveTextContent(/^(5:00|4:5\d)$/)
    expect(within(summary).getByText(/para pagar/)).toBeInTheDocument()
  })

  it('offers the standard autocomplete hints and hides the CVV', async () => {
    await ready()
    expect(input('fullName')).toHaveAttribute('autocomplete', 'name')
    expect(input('email')).toHaveAttribute('autocomplete', 'email')
    expect(input('phone')).toHaveAttribute('autocomplete', 'tel')
    expect(input('holderName')).toHaveAttribute('autocomplete', 'cc-name')
    expect(input('cardNumber')).toHaveAttribute('autocomplete', 'cc-number')
    expect(input('expiry')).toHaveAttribute('autocomplete', 'cc-exp')
    expect(input('cvv')).toHaveAttribute('autocomplete', 'cc-csc')
    expect(input('cvv')).toHaveAttribute('type', 'password')
    expect(input('phone').value).toBe('+57')
  })

  it('without a seat of mine it goes back to the map with a notice', async () => {
    snapshotMock.mockResolvedValue(snapshot(null))
    renderPage()

    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
    expect(screen.getByText('Primero elige un asiento.')).toBeInTheDocument()
  })

  it('with a seat whose checkout has not started it goes back to the map, where "Continuar al pago" starts it', async () => {
    snapshotMock.mockResolvedValue(snapshot({ payableUntil: undefined }))
    renderPage()
    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
  })

  it('a lock that is gone (released event) sends the user back with a notice', async () => {
    await ready()
    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('seat.released', { type: 'seat.released', flightId: FLIGHT_ID, seat: '3C', version: 9, reason: 'EXPIRED' })
    })
    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
    expect(screen.getByText(/Tu bloqueo venció/)).toBeInTheDocument()
  })

  it('says so when the flight does not exist', async () => {
    snapshotMock.mockRejectedValue(new ApiError(404, 'FLIGHT_NOT_FOUND', 'x'))
    renderPage()
    expect(await screen.findByText('No encontramos este vuelo.')).toBeInTheDocument()
  })

  it('"Volver al mapa" keeps the lock: it does not call the API', async () => {
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al mapa de asientos' }))
    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
    expect(unlockMock).not.toHaveBeenCalled()
  })
})

describe('CheckoutPage: the form', () => {
  it('formats the card and the expiry while typing, and keeps the CVV to digits', async () => {
    await ready()
    fireEvent.change(input('cardNumber'), { target: { value: '4111111111111111' } })
    fireEvent.change(input('expiry'), { target: { value: '1230' } })
    fireEvent.change(input('cvv'), { target: { value: '12a3' } })

    expect(input('cardNumber').value).toBe('4111 1111 1111 1111')
    expect(input('expiry').value).toBe('12/30')
    expect(input('cvv').value).toBe('123')
  })

  it('checks a field when the user leaves it, and clears the message as soon as it is fixed', async () => {
    await ready()
    fireEvent.blur(input('email'))
    expect(await screen.findByText('Este campo es obligatorio')).toBeInTheDocument()
    expect(input('email')).toHaveAttribute('aria-invalid', 'true')
    expect(input('email').getAttribute('aria-describedby')).toBe('email-error')

    fireEvent.change(input('email'), { target: { value: 'laura@correo.com' } })
    expect(screen.queryByText('Este campo es obligatorio')).not.toBeInTheDocument()
    expect(input('email')).not.toHaveAttribute('aria-invalid')
  })

  it('an invalid submit marks every problem, focuses the first one and sends nothing', async () => {
    await ready()
    fill({ fullName: '', cvv: '1' })
    pay()

    expect(await screen.findByText('Revisa los campos marcados.')).toBeInTheDocument()
    expect(document.activeElement).toBe(input('fullName'))
    expect(screen.getByText('El CVV tiene 3 o 4 dígitos')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('the document rules follow the document type', async () => {
    await ready()
    fireEvent.change(input('documentNumber'), { target: { value: 'AB12345' } })
    fireEvent.blur(input('documentNumber'))
    expect(await screen.findByText(/La cédula tiene de 6 a 10 dígitos/)).toBeInTheDocument()

    fireEvent.change(document.getElementById('documentType') as HTMLElement, { target: { value: 'PASSPORT' } })
    await waitFor(() => expect(screen.queryByText(/La cédula tiene/)).not.toBeInTheDocument())
  })

  it('an expired card is rejected in place', async () => {
    await ready()
    fireEvent.change(input('expiry'), { target: { value: '0126' } })
    fireEvent.blur(input('expiry'))
    expect(await screen.findByText('La tarjeta está vencida')).toBeInTheDocument()
  })

  it('never writes card or personal data to any storage', async () => {
    await ready()
    fill()
    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage })
    for (const secret of ['4111', 'Laura', '1234567890', 'correo', '300 123']) {
      expect(stored).not.toContain(secret)
    }
  })
})

describe('CheckoutPage: paying', () => {
  it('sends the normalized data with the client id and an idempotency key, then opens the ticket', async () => {
    createMock.mockResolvedValue(ticket())
    await ready()
    fill()
    pay()

    expect(await screen.findByText(/Boleto \/booking\/MF8BC4 MF8BC4/)).toBeInTheDocument()
    const [input_, clientId, key] = createMock.mock.calls[0]
    expect(input_).toEqual({
      flightId: FLIGHT_ID,
      seat: '3C',
      passenger: {
        fullName: 'Laura Gómez Peña',
        email: 'laura@correo.com',
        documentType: 'CC',
        documentNumber: '1234567890',
        phone: '+573001234567'
      },
      payment: { holderName: 'LAURA GOMEZ', cardNumber: '4111111111111111', expiry: '12/30', cvv: '123' }
    })
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('blocks the button and the fields while the payment is processed', async () => {
    let finish: (value: ReservationDTO) => void = () => undefined
    createMock.mockReturnValue(new Promise<ReservationDTO>((resolve) => (finish = resolve)))
    await ready()
    fill()
    pay()

    const button = await screen.findByRole('button', { name: 'Procesando pago…' })
    expect(button).toBeDisabled()
    expect(input('cardNumber')).toBeDisabled()
    fireEvent.click(button)
    expect(createMock).toHaveBeenCalledTimes(1)

    await act(async () => finish(ticket()))
    expect(await screen.findByText(/MF8BC4/)).toBeInTheDocument()
  })

  it('a rejected card (402) shows only the notice; the form, the lock and the countdown stay', async () => {
    createMock.mockRejectedValue(new ApiError(402, 'PAYMENT_DECLINED', 'x'))
    await ready()
    fill({ cardNumber: '4111111111110000' })
    pay()

    expect(await screen.findByText('El pago fue rechazado.')).toBeInTheDocument()
    expect(input('cardNumber').value).toBe('4111 1111 1111 0000')
    expect(input('fullName').value).toBe('Laura Gómez Peña')
    expect(screen.getByRole('timer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagar y confirmar' })).toBeEnabled()
    // Only the notice: no hint about how to get a different outcome
    expect(document.querySelector('.summary__message')?.textContent).toBe('El pago fue rechazado.')
  })

  it('reuses the idempotency key after a network failure and renews it after a rejection', async () => {
    createMock
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'))
      .mockRejectedValueOnce(new ApiError(402, 'PAYMENT_DECLINED', 'x'))
      .mockRejectedValueOnce(new ApiError(402, 'PAYMENT_DECLINED', 'x'))
    await ready()
    fill()

    pay()
    await screen.findByText(/No pudimos conectar con el servidor/)
    pay()
    await screen.findByText('El pago fue rechazado.')
    pay()
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(3))

    const keys = createMock.mock.calls.map((call) => call[2])
    expect(keys[1]).toBe(keys[0]) // same request retried after the network failed
    expect(keys[2]).not.toBe(keys[1]) // new attempt after a 402
  })

  it.each([
    ['REQUEST_IN_PROGRESS', 409, 'Tu pago sigue en curso'],
    ['PAYMENT_UNAVAILABLE', 503, 'La pasarela de pago no está disponible'],
    ['INTERNAL_ERROR', 500, 'No pudimos procesar el pago']
  ])('a %s answer shows its own message and stays on the page', async (code, status, text) => {
    createMock.mockRejectedValue(new ApiError(status, code, 'x'))
    await ready()
    fill()
    pay()

    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagar y confirmar' })).toBeInTheDocument()
  })

  it('a lock that expired meanwhile (409) sends the user back to the map', async () => {
    createMock.mockRejectedValue(new ApiError(409, 'LOCK_EXPIRED_OR_NOT_OWNED', 'x'))
    await ready()
    fill()
    pay()

    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
    expect(screen.getByText(/Tu bloqueo venció. Elige un asiento de nuevo/)).toBeInTheDocument()
  })

  it('a flight that is no longer bookable (409) sends the user back to the map', async () => {
    createMock.mockRejectedValue(new ApiError(409, 'FLIGHT_NOT_BOOKABLE', 'x'))
    await ready()
    fill()
    pay()

    expect(await screen.findByText('Pantalla del mapa')).toBeInTheDocument()
    expect(screen.getByText(/ya no está disponible para la venta/)).toBeInTheDocument()
  })

  it('a flight cancelled during the payment blocks the submit and says why', async () => {
    await ready()
    act(() => {
      FakeEventSource.latest().open()
      FakeEventSource.latest().emit('flight.updated', {
        type: 'flight.updated',
        flightId: FLIGHT_ID,
        status: FlightStatus.CANCELLED,
        availableSeats: 0,
        version: 5
      })
    })

    expect(await screen.findByText('Este vuelo fue cancelado. No es posible pagar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pagar y confirmar' })).toBeDisabled()
  })
})

describe('CheckoutPage: the countdown', () => {
  it('at zero it releases the seat, goes back to the map and explains it', async () => {
    snapshotMock.mockResolvedValue(snapshot({ payableUntil: inSeconds(1), lockedUntil: inSeconds(11) }))
    renderPage()
    await screen.findByRole('button', { name: 'Pagar y confirmar' })

    expect(await screen.findByText('Pantalla del mapa', undefined, { timeout: 4000 })).toBeInTheDocument()
    expect(unlockMock).toHaveBeenCalledWith(FLIGHT_ID, '3C', expect.any(String))
    expect(screen.getByText('Tu tiempo para pagar venció. El asiento volvió a estar libre.')).toBeInTheDocument()
  })

  it('does not redirect while a payment is in flight: it waits for the answer', async () => {
    let reject: (error: unknown) => void = () => undefined
    createMock.mockReturnValue(new Promise<ReservationDTO>((_, rej) => (reject = rej)))
    snapshotMock.mockResolvedValue(snapshot({ payableUntil: inSeconds(1.5), lockedUntil: inSeconds(11) }))
    renderPage()
    await screen.findByRole('button', { name: 'Pagar y confirmar' })
    fill()
    pay()
    await screen.findByRole('button', { name: 'Procesando pago…' })

    await new Promise((resolve) => setTimeout(resolve, 2200))
    expect(screen.queryByText('Pantalla del mapa')).not.toBeInTheDocument()
    expect(unlockMock).not.toHaveBeenCalled()

    await act(async () => reject(new ApiError(402, 'PAYMENT_DECLINED', 'x')))
    expect(await screen.findByText('Pantalla del mapa', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(unlockMock).toHaveBeenCalledTimes(1)
  })

  it('a payment that succeeds right at the deadline still shows the ticket', async () => {
    let resolve: (value: ReservationDTO) => void = () => undefined
    createMock.mockReturnValue(new Promise<ReservationDTO>((res) => (resolve = res)))
    snapshotMock.mockResolvedValue(snapshot({ payableUntil: inSeconds(1.5), lockedUntil: inSeconds(11) }))
    renderPage()
    await screen.findByRole('button', { name: 'Pagar y confirmar' })
    fill()
    pay()
    await screen.findByRole('button', { name: 'Procesando pago…' })
    await new Promise((res) => setTimeout(res, 2200))

    await act(async () => resolve(ticket()))
    expect(await screen.findByText(/Boleto \/booking\/MF8BC4/)).toBeInTheDocument()
    expect(unlockMock).not.toHaveBeenCalled()
  })

  it('stands out in the last minute with text', async () => {
    snapshotMock.mockResolvedValue(snapshot({ payableUntil: inSeconds(40), lockedUntil: inSeconds(50) }))
    renderPage()
    await screen.findByRole('button', { name: 'Pagar y confirmar' })
    expect((await screen.findAllByText('Te queda 1 minuto')).length).toBeGreaterThan(0)
  })
})
