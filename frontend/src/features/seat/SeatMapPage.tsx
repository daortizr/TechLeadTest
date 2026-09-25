import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FlightStatus } from '@flight-reservations/shared'
import { api, ApiError } from '../../api/client'
import { AlertIcon, ArrowLeftIcon, Button } from '../../components'
import { useAirports } from '../../hooks/useAirports'
import { useServerNow } from '../../hooks/useServerNow'
import { getClientId } from '../../lib/clientId'
import { formatDeparture, formatFlightCode } from '../../lib/format'
import { SEAT_LABELS } from '../../lib/labels'
import { flightCounts, useResync, useStore } from '../../realtime'
import OccupancyPanel from './OccupancyPanel'
import SeatGrid from './SeatGrid'
import SeatLegend from './SeatLegend'
import SelectionPanel from './SelectionPanel'
import { useSeatSelection } from './useSeatSelection'
import './SeatMapPage.css'

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error'

export default function SeatMapPage(): React.ReactElement {
  const { flightId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { state, dispatch } = useStore()
  const airports = useAirports()
  const now = useServerNow(1000)

  const [status, setStatus] = useState<LoadStatus>('loading')
  const controller = useRef<AbortController | null>(null)
  const requestCounter = useRef(0)

  const load = useCallback(
    (silent: boolean) => {
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      const requestId = ++requestCounter.current

      api.flights
        .seatSnapshot(flightId, getClientId(), abort.signal)
        .then((snapshot) => {
          if (requestId !== requestCounter.current) return
          dispatch({ type: 'SNAPSHOT_LOADED', snapshot, receivedAt: Date.now() })
          setStatus('ready')
        })
        .catch((error: unknown) => {
          if (requestId !== requestCounter.current) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
            setStatus('not-found')
          } else if (!silent) {
            setStatus('error')
          }
        })
    },
    [flightId, dispatch]
  )

  useEffect(() => {
    setStatus('loading')
    load(false)
    return () => controller.current?.abort()
  }, [load])

  // On (re)connection or when the tab returns, reload quietly: the database is the source of truth
  const reload = useCallback(() => load(true), [load])
  useResync(reload)

  const { busy, select, release, continueToPayment } = useSeatSelection(flightId, reload)

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'))

  const flight = state.flights[flightId]
  const seats = state.seats[flightId]
  const myLock = state.myLock[flightId] ?? null
  const counts = flightCounts(state, flightId)

  if (status === 'not-found') {
    return (
      <div className="state-card" role="alert">
        <p>{SEAT_LABELS.flightNotFound}</p>
        <Link to="/">{SEAT_LABELS.back}</Link>
      </div>
    )
  }

  if (status === 'error' && !seats) {
    return (
      <div className="state-card" role="alert">
        <p>{SEAT_LABELS.loadError}</p>
        <Button variant="outline" onClick={() => load(false)}>
          {SEAT_LABELS.retry}
        </Button>
      </div>
    )
  }

  if (!flight || !seats || !counts) {
    return (
      <div className="seat-page" aria-busy="true">
        <div className="seat-layout">
          <div className="card seat-map seat-map--skeleton" aria-label={SEAT_LABELS.loading} role="status" />
        </div>
      </div>
    )
  }

  const readOnlyReason =
    flight.status === FlightStatus.CANCELLED
      ? SEAT_LABELS.readOnly.CANCELLED
      : flight.status === FlightStatus.SOLD_OUT
        ? SEAT_LABELS.readOnly.SOLD_OUT
        : new Date(flight.departureAt).getTime() <= now
          ? SEAT_LABELS.readOnly.DEPARTED
          : null

  const cityOf = (code: string): string => airports?.find((airport) => airport.code === code)?.city ?? code
  const connectionLost = state.connection.state === 'reconnecting'

  return (
    <div className="seat-page">
      <button type="button" className="back-link" onClick={goBack}>
        <ArrowLeftIcon size={18} />
        {SEAT_LABELS.back}
      </button>

      <div className="seat-layout">
        <SelectionPanel
          lock={myLock}
          price={flight.price}
          currency={flight.currency}
          canContinue={readOnlyReason === null}
          busy={busy}
          onContinue={continueToPayment}
          onRelease={release}
          onExpire={() => {
            // The server event usually arrives first; this covers a late or missed one
            if (state.myLock[flightId]) {
              dispatch({ type: 'MY_LOCK_SET', flightId, lock: null })
              dispatch({ type: 'NOTICE_SHOWN', kind: 'warning', text: SEAT_LABELS.notices.lockExpired })
              reload()
            }
          }}
        />

        <section className="card seat-map" aria-labelledby="seat-map-title">
          <header className="seat-map__header">
            <h1 id="seat-map-title">
              {formatFlightCode(flight.code)} · {cityOf(flight.origin)} a {cityOf(flight.destination)}
            </h1>
            <p className="seat-map__departure">{formatDeparture(flight.departureAt)}</p>
          </header>

          {readOnlyReason && (
            <p className="map-banner" role="status">
              <AlertIcon size={18} />
              <span>{readOnlyReason}</span>
            </p>
          )}
          {connectionLost && (
            <p className="map-banner" role="status">
              <AlertIcon size={18} />
              <span>{SEAT_LABELS.stale}</span>
            </p>
          )}

          <SeatLegend />
          <SeatGrid seats={seats} now={now} locked={readOnlyReason !== null || busy} onSelect={select} />
        </section>

        <OccupancyPanel counts={counts} />
      </div>
    </div>
  )
}
