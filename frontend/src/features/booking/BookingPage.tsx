import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { FlightStatus } from '@flight-reservations/shared'
import type { ReservationDTO } from '@flight-reservations/shared'
import { api, ApiError } from '../../api/client'
import { AlertIcon, Button, CheckIcon, CopyIcon, LinkIcon } from '../../components'
import { useAirports } from '../../hooks/useAirports'
import { BOOKING_LABELS } from '../../lib/labels'
import { useResync, useStore } from '../../realtime'
import TicketCard from './TicketCard'
import { useCopy } from './useCopy'
import './BookingPage.css'

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error'

// The payment screen hands the ticket over so it shows at once; a reload fetches it by code
function ticketFromNavigation(locationState: unknown, code: string): ReservationDTO | null {
  const candidate = (locationState as { reservation?: ReservationDTO } | null)?.reservation
  return candidate && candidate.code === code ? candidate : null
}

export default function BookingPage(): React.ReactElement {
  const { code = '' } = useParams()
  const location = useLocation()
  const { state, dispatch } = useStore()
  const airports = useAirports()
  const { feedback, copy } = useCopy()

  const [ticket, setTicket] = useState<ReservationDTO | null>(() => ticketFromNavigation(location.state, code))
  const [status, setStatus] = useState<LoadStatus>(ticket ? 'ready' : 'loading')
  const controller = useRef<AbortController | null>(null)
  const requestCounter = useRef(0)

  const load = useCallback(
    (silent: boolean) => {
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      const requestId = ++requestCounter.current

      api.reservations
        .getByCode(code, abort.signal)
        .then((loaded) => {
          if (requestId !== requestCounter.current) return
          setTicket(loaded)
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (requestId !== requestCounter.current) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof ApiError && error.status === 404) setStatus('not-found')
          else if (!silent) setStatus('error')
        })
    },
    [code]
  )

  useEffect(() => {
    // With the ticket already in hand this is a quiet refresh
    load(ticket !== null)
    return () => controller.current?.abort()
  }, [code])

  const reload = useCallback(() => load(true), [load])
  useResync(reload)

  // The ticket's flight joins the shared store, so a cancellation arriving on the stream shows up live
  useEffect(() => {
    if (ticket) dispatch({ type: 'FLIGHTS_LOADED', flights: [ticket.flight] })
  }, [ticket, dispatch])

  if (status === 'not-found') {
    return (
      <div className="state-card" role="alert">
        <p>{BOOKING_LABELS.notFound}</p>
        <Link to="/">{BOOKING_LABELS.search}</Link>
      </div>
    )
  }

  if (status === 'error' && !ticket) {
    return (
      <div className="state-card" role="alert">
        <p>{BOOKING_LABELS.loadError}</p>
        <Button variant="outline" onClick={() => load(false)}>
          {BOOKING_LABELS.retry}
        </Button>
      </div>
    )
  }

  if (!ticket) {
    return <div className="card booking-skeleton" role="status" aria-busy="true" aria-label={BOOKING_LABELS.loading} />
  }

  const flight = state.flights[ticket.flight.id] ?? ticket.flight
  const cancelled = flight.status === FlightStatus.CANCELLED
  const cityOf = (airportCode: string): string =>
    airports?.find((airport) => airport.code === airportCode)?.city ?? airportCode
  const link = `${window.location.origin}/booking/${ticket.code}`

  return (
    <div className="booking-page">
      <div className="booking-hero">
        <span className="booking-hero__badge" aria-hidden="true">
          <CheckIcon size={32} />
        </span>
        <h1>{BOOKING_LABELS.confirmed}</h1>
      </div>

      {/* Live: appears too if the flight is cancelled while the ticket is open */}
      <div role="alert">
        {cancelled && (
          <div className="booking-cancelled">
            <p className="booking-cancelled__title">
              <AlertIcon size={20} />
              <span>{BOOKING_LABELS.cancelled}</span>
            </p>
            <p>{BOOKING_LABELS.cancelledHelp}</p>
          </div>
        )}
      </div>

      <TicketCard
        ticket={{ ...ticket, flight }}
        originCity={cityOf(flight.origin)}
        destinationCity={cityOf(flight.destination)}
      />

      <div className="booking-actions">
        <Button variant="neutral" onClick={() => copy(ticket.code, BOOKING_LABELS.codeCopied)}>
          <CopyIcon size={18} />
          {BOOKING_LABELS.copyCode}
        </Button>
        <Button variant="neutral" onClick={() => copy(link, BOOKING_LABELS.linkCopied)}>
          <LinkIcon size={18} />
          {BOOKING_LABELS.copyLink}
        </Button>
      </div>

      <p className="booking-feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </div>
  )
}
