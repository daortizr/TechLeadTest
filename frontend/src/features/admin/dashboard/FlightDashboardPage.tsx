import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../../../api/client'
import { AlertIcon, Button } from '../../../components'
import { useAirports } from '../../../hooks/useAirports'
import { useServerNow } from '../../../hooks/useServerNow'
import { formatTime } from '../../../lib/format'
import { ADMIN_LABELS } from '../../../lib/labels'
import { flightCounts, useResync, useStore } from '../../../realtime'
import ActivityCard from './ActivityCard'
import HeatMap from './HeatMap'
import LockStagesCard from './LockStagesCard'
import OccupancyCard from './OccupancyCard'
import { useLockStages } from './useLockStages'
import './FlightDashboardPage.css'

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error'

const D = ADMIN_LABELS.dashboard

// Read-only view of one flight. The snapshot is requested without a client id: the administrator
// holds no seats, so nothing here is "mine".
export default function FlightDashboardPage(): React.ReactElement {
  const { flightId = '' } = useParams()
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
        .seatSnapshot(flightId, undefined, abort.signal)
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

  const reload = useCallback(() => load(true), [load])
  useResync(reload)

  const activity = state.activity[flightId] ?? []
  const { stages, failed } = useLockStages(flightId, activity[0]?.id ?? null)

  const flight = state.flights[flightId]
  const seats = state.seats[flightId]
  const counts = flightCounts(state, flightId)

  if (status === 'not-found') {
    return (
      <div className="state-card" role="alert">
        <p>{D.notFound}</p>
        <Link to="/admin/dashboard">{D.back}</Link>
      </div>
    )
  }

  if (status === 'error' && !seats) {
    return (
      <div className="state-card" role="alert">
        <p>{D.loadError}</p>
        <Button variant="outline" onClick={() => load(false)}>
          {D.retry}
        </Button>
      </div>
    )
  }

  if (!flight || !seats || !counts) {
    return <div className="card dash-skeleton" role="status" aria-busy="true" aria-label={D.loading} />
  }

  const cityOf = (code: string): string => airports?.find((airport) => airport.code === code)?.city ?? code
  const stale = state.connection.state !== 'live'
  const lastMessageAt = state.connection.lastMessageAt
  const summary = `${counts.occupancyPercent}% ${D.occupied}: ${counts.available} ${D.free.toLowerCase()}, ${counts.blocked} ${D.blocked.toLowerCase()}, ${counts.reserved} ${D.sold.toLowerCase()}`

  return (
    <div className="dash-page">
      {stale && (
        <p className="dash-stale" role="status">
          <AlertIcon size={16} />
          <span>{lastMessageAt === null ? D.staleUnknown : D.staleSince(formatTime(new Date(lastMessageAt)))}</span>
        </p>
      )}

      <OccupancyCard
        flight={flight}
        originCity={cityOf(flight.origin)}
        destinationCity={cityOf(flight.destination)}
        counts={counts}
      />
      <HeatMap seats={seats} now={now} summary={summary} />
      <LockStagesCard stages={stages} failed={failed} />
      <ActivityCard items={activity} now={Date.now()} />
    </div>
  )
}
