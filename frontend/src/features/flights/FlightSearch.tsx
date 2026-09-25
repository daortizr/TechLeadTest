import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AirportDTO, FlightDTO } from '@flight-reservations/shared'
import { api, ApiError } from '../../api/client'
import { Button } from '../../components'
import { bogotaDate, formatShortDate } from '../../lib/format'
import { SEARCH_LABELS, flightsFoundLabel } from '../../lib/labels'
import { useResync, useStore } from '../../realtime'
import FlightCard from './FlightCard'
import type { CardAction } from './FlightCard'
import './FlightSearch.css'

interface SearchQuery {
  origin: string
  destination: string
  date: string
}

type SearchStatus = 'idle' | 'loading' | 'error'

const DEFAULT_ORIGIN = 'BOG'
const DEFAULT_DESTINATION = 'MDE'

function airportLabel(airport: AirportDTO): string {
  return `${airport.city} (${airport.code})`
}

function validate(query: SearchQuery): string | null {
  if (!query.date) return SEARCH_LABELS.missingDate
  if (query.origin === query.destination) return SEARCH_LABELS.sameAirports
  if (query.date < bogotaDate(0)) return SEARCH_LABELS.pastDate
  return null
}

interface FlightSearchProps {
  // How each result behaves: the public search and the admin dashboard share everything else
  describeFlight: (flight: FlightDTO) => CardAction
}

// Search form + results, with its state in the URL. Shared by / and /admin/dashboard.
export default function FlightSearch({ describeFlight }: FlightSearchProps): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const { state, dispatch } = useStore()

  const [airports, setAirports] = useState<AirportDTO[] | null>(null)
  const [airportsError, setAirportsError] = useState(false)
  const [form, setForm] = useState<SearchQuery>({
    origin: searchParams.get('origin') ?? DEFAULT_ORIGIN,
    destination: searchParams.get('destination') ?? DEFAULT_DESTINATION,
    date: searchParams.get('date') ?? bogotaDate(1)
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [resultIds, setResultIds] = useState<string[] | null>(null)

  // The URL is the source of truth for the active search, so "back" from the map restores it
  const activeQuery = useMemo<SearchQuery | null>(() => {
    const origin = searchParams.get('origin')
    const destination = searchParams.get('destination')
    const date = searchParams.get('date')
    return origin && destination && date ? { origin, destination, date } : null
  }, [searchParams])

  const requestCounter = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const loadAirports = useCallback(() => {
    setAirportsError(false)
    api.airports
      .list()
      .then(setAirports)
      .catch(() => setAirportsError(true))
  }, [])

  useEffect(() => {
    loadAirports()
  }, [loadAirports])

  // First visit: run the default search so the page opens with results
  useEffect(() => {
    if (airports && !activeQuery && !validate(form)) {
      setSearchParams({ ...form }, { replace: true })
    }
  }, [airports])

  const runSearch = useCallback(
    (query: SearchQuery, silent: boolean) => {
      controller.current?.abort()
      const abort = new AbortController()
      controller.current = abort
      const requestId = ++requestCounter.current

      if (!silent) setStatus('loading')

      api.flights
        .search(query.origin, query.destination, query.date, abort.signal)
        .then((flights: FlightDTO[]) => {
          if (requestId !== requestCounter.current) return
          dispatch({ type: 'FLIGHTS_LOADED', flights })
          setResultIds(flights.map((flight) => flight.id))
          setStatus('idle')
        })
        .catch((error: unknown) => {
          if (requestId !== requestCounter.current) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          setErrorMessage(error instanceof ApiError ? error.message : SEARCH_LABELS.retry)
          setStatus('error')
        })
    },
    [dispatch]
  )

  useEffect(() => {
    if (!activeQuery) return
    setForm(activeQuery)
    // A link can carry values the form would have rejected (e.g. a date that is now in the past)
    const problem = validate(activeQuery)
    setFormError(problem)
    if (problem) {
      setResultIds(null)
      setStatus('idle')
      return
    }
    runSearch(activeQuery, false)
    return () => controller.current?.abort()
  }, [activeQuery, runSearch])

  // On (re)connection or when the tab returns, reload quietly: the database is the source of truth
  useResync(() => {
    if (activeQuery && !validate(activeQuery)) runSearch(activeQuery, true)
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const problem = validate(form)
    setFormError(problem)
    if (problem) return
    if (activeQuery && activeQuery.origin === form.origin && activeQuery.destination === form.destination && activeQuery.date === form.date) {
      runSearch(form, false)
    } else {
      setSearchParams({ ...form })
    }
  }

  const cityOf = (code: string): string => airports?.find((airport) => airport.code === code)?.city ?? code
  const flights = (resultIds ?? []).map((id) => state.flights[id]).filter((flight): flight is FlightDTO => Boolean(flight))
  const loading = status === 'loading'

  return (
    <div className="search-page">
      <section className="search-card" aria-label="Buscar vuelos">
        <form className="search-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="origin">{SEARCH_LABELS.origin}</label>
            <select
              id="origin"
              value={form.origin}
              disabled={!airports}
              onChange={(event) => setForm({ ...form, origin: event.target.value })}
            >
              {(airports ?? []).map((airport) => (
                <option key={airport.code} value={airport.code}>
                  {airportLabel(airport)}
                </option>
              ))}
              {!airports && <option value={form.origin}>{SEARCH_LABELS.loadingAirports}</option>}
            </select>
          </div>

          <div className="field">
            <label htmlFor="destination">{SEARCH_LABELS.destination}</label>
            <select
              id="destination"
              value={form.destination}
              disabled={!airports}
              onChange={(event) => setForm({ ...form, destination: event.target.value })}
            >
              {(airports ?? []).map((airport) => (
                <option key={airport.code} value={airport.code}>
                  {airportLabel(airport)}
                </option>
              ))}
              {!airports && <option value={form.destination}>{SEARCH_LABELS.loadingAirports}</option>}
            </select>
          </div>

          <div className="field">
            <label htmlFor="date">{SEARCH_LABELS.date}</label>
            <input
              id="date"
              type="date"
              value={form.date}
              min={bogotaDate(0)}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </div>

          <Button type="submit" className="search-form__submit" disabled={loading || !airports}>
            {loading ? SEARCH_LABELS.submitting : SEARCH_LABELS.submit}
          </Button>
        </form>

        <div className="form-message" role="alert">
          {formError}
        </div>
        {airportsError && (
          <div className="form-message">
            {SEARCH_LABELS.airportsError}{' '}
            <button type="button" className="link-button" onClick={loadAirports}>
              {SEARCH_LABELS.retry}
            </button>
          </div>
        )}
      </section>

      <div className="results-summary" aria-live="polite">
        {status === 'idle' && resultIds !== null && activeQuery && (
          <>
            {flightsFoundLabel(flights.length)} · {cityOf(activeQuery.origin)} a {cityOf(activeQuery.destination)} ·{' '}
            {formatShortDate(activeQuery.date)}
          </>
        )}
      </div>

      {loading && (
        <ul className="flight-list" aria-busy="true" aria-label="Cargando vuelos">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flight-card flight-card--skeleton" aria-hidden="true" />
          ))}
        </ul>
      )}

      {status === 'error' && (
        <div className="state-card" role="alert">
          <p>{errorMessage}</p>
          <Button variant="outline" onClick={() => activeQuery && runSearch(activeQuery, false)}>
            {SEARCH_LABELS.retry}
          </Button>
        </div>
      )}

      {status === 'idle' && resultIds !== null && flights.length === 0 && (
        <div className="state-card">
          <p>{SEARCH_LABELS.noResults}</p>
        </div>
      )}

      {status !== 'loading' && flights.length > 0 && (
        <ul className="flight-list">
          {flights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              originCity={cityOf(flight.origin)}
              destinationCity={cityOf(flight.destination)}
              action={describeFlight(flight)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
