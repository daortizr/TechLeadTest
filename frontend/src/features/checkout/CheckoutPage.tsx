import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FlightStatus } from '@flight-reservations/shared'
import { api, ApiError } from '../../api/client'
import { AlertIcon, Button, Countdown } from '../../components'
import { useAirports } from '../../hooks/useAirports'
import { getClientId, generateId } from '../../lib/clientId'
import { CHECKOUT_LABELS } from '../../lib/labels'
import { serverNowMs, useResync, useStore } from '../../realtime'
import CardForm from './CardForm'
import OrderSummary from './OrderSummary'
import PassengerForm from './PassengerForm'
import { useCheckoutForm } from './useCheckoutForm'
import { toReservationInput } from './validation'
import './CheckoutPage.css'

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error'

export default function CheckoutPage(): React.ReactElement {
  const { flightId = '' } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
  const airports = useAirports()

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const stateRef = useRef(state)
  stateRef.current = state
  const { form, errors, setField, blurField, validateAll } = useCheckoutForm(() => serverNowMs(stateRef.current))

  // One key per attempt: reused when the network fails, renewed after a rejection (402)
  const idempotencyKey = useRef(generateId())
  const hadLock = useRef(false)
  const leaving = useRef(false)
  const expiredWhileSubmitting = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const requestCounter = useRef(0)

  const flight = state.flights[flightId]
  const lock = state.myLock[flightId] ?? null

  const backToMap = useCallback(
    (notice?: string) => {
      leaving.current = true
      if (notice) dispatch({ type: 'NOTICE_SHOWN', kind: 'warning', text: notice })
      navigate(`/flights/${flightId}`, { replace: true })
    },
    [dispatch, flightId, navigate]
  )

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
          if (error instanceof ApiError && (error.status === 404 || error.status === 400)) setStatus('not-found')
          else if (!silent) setStatus('error')
        })
    },
    [flightId, dispatch]
  )

  useEffect(() => {
    setStatus('loading')
    load(false)
    return () => controller.current?.abort()
  }, [load])

  // Reload on reconnection or when the tab returns: the lock may have changed meanwhile
  const reload = useCallback(() => load(true), [load])
  useResync(reload)

  // Protected entry. Without my own seat in checkout there is nothing to pay: back to the map.
  // (Also covers a reload: the snapshot carries payableUntil.)
  useEffect(() => {
    if (status !== 'ready' || submitting || leaving.current) return
    if (lock) {
      hadLock.current = true
      // Selected but checkout not started (e.g. the URL typed by hand): the map starts it
      if (!lock.payableUntil) backToMap()
      return
    }
    backToMap(hadLock.current ? CHECKOUT_LABELS.notices.lockLost : CHECKOUT_LABELS.notices.noSeat)
  }, [status, lock, submitting, backToMap])

  // The countdown reached zero: release the seat (if that fails the lock expires by itself in
  // seconds) and go back to the map. With a payment in flight, wait for its answer first.
  const handleExpire = useCallback(() => {
    if (leaving.current) return
    if (submitting) {
      expiredWhileSubmitting.current = true
      return
    }
    const seat = stateRef.current.myLock[flightId]?.seat
    if (seat) {
      api.seats.unlock(flightId, seat, getClientId()).catch((error: unknown) => {
        console.warn('Could not release the seat, its lock will expire by itself', error)
      })
    }
    dispatch({ type: 'MY_LOCK_SET', flightId, lock: null })
    backToMap(CHECKOUT_LABELS.notices.timeUp)
  }, [backToMap, dispatch, flightId, submitting])

  const failSubmit = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) {
        setMessage(CHECKOUT_LABELS.generic)
        return
      }
      switch (error.code) {
        case 'PAYMENT_DECLINED':
          // Only the notice: no hint on how to get a different outcome. Lock and countdown stay.
          setMessage(CHECKOUT_LABELS.declined)
          idempotencyKey.current = generateId()
          break
        case 'LOCK_EXPIRED_OR_NOT_OWNED':
          dispatch({ type: 'MY_LOCK_SET', flightId, lock: null })
          backToMap(CHECKOUT_LABELS.notices.lockLost)
          break
        case 'FLIGHT_NOT_BOOKABLE':
          backToMap(CHECKOUT_LABELS.notices.notBookable)
          break
        case 'REQUEST_IN_PROGRESS':
          setMessage(CHECKOUT_LABELS.inProgress)
          break
        case 'PAYMENT_UNAVAILABLE':
          setMessage(CHECKOUT_LABELS.gatewayDown)
          break
        case 'NETWORK':
          setMessage(CHECKOUT_LABELS.network)
          break
        default:
          setMessage(CHECKOUT_LABELS.generic)
          idempotencyKey.current = generateId()
      }
    },
    [backToMap, dispatch, flightId]
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || !lock) return

    setMessage(null)
    if (validateAll()) {
      setFormMessage(CHECKOUT_LABELS.formInvalid)
      return
    }
    setFormMessage(null)

    setSubmitting(true)
    try {
      const reservation = await api.reservations.create(
        toReservationInput(form, flightId, lock.seat),
        getClientId(),
        idempotencyKey.current
      )
      leaving.current = true
      // Only the ticket travels along: it never carries document, phone or e-mail
      navigate(`/booking/${reservation.code}`, { replace: true, state: { reservation } })
    } catch (error) {
      failSubmit(error)
    } finally {
      setSubmitting(false)
      if (expiredWhileSubmitting.current && !leaving.current) {
        expiredWhileSubmitting.current = false
        handleExpire()
      }
    }
  }

  if (status === 'not-found') {
    return (
      <div className="state-card" role="alert">
        <p>No encontramos este vuelo.</p>
        <Link to="/">Volver a la búsqueda</Link>
      </div>
    )
  }

  if (status === 'error' && !flight) {
    return (
      <div className="state-card" role="alert">
        <p>{CHECKOUT_LABELS.loadError}</p>
        <Button variant="outline" onClick={() => load(false)}>
          {CHECKOUT_LABELS.retry}
        </Button>
      </div>
    )
  }

  if (status !== 'ready' || !flight || !lock?.payableUntil) {
    return <div className="card checkout-skeleton" role="status" aria-busy="true" aria-label={CHECKOUT_LABELS.loading} />
  }

  const cancelled = flight.status === FlightStatus.CANCELLED
  const cityOf = (code: string): string => airports?.find((airport) => airport.code === code)?.city ?? code

  return (
    <form className="checkout-page" onSubmit={handleSubmit} noValidate>
      {/* Phones: the countdown stays in view while the form scrolls */}
      <div className="checkout-sticky" aria-hidden="true">
        <Countdown
          variant="sentence"
          until={lock.payableUntil}
          label={CHECKOUT_LABELS.countdownBefore}
          suffix={CHECKOUT_LABELS.countdownAfter}
        />
      </div>

      <div className="checkout-layout">
        <div className="checkout-forms">
          {cancelled && (
            <p className="checkout-banner" role="alert">
              <AlertIcon size={18} />
              <span>{CHECKOUT_LABELS.flightCancelled}</span>
            </p>
          )}
          {formMessage && (
            <p className="checkout-banner" role="alert">
              <AlertIcon size={18} />
              <span>{formMessage}</span>
            </p>
          )}
          <PassengerForm form={form} errors={errors} disabled={submitting} onChange={setField} onBlur={blurField} />
          <CardForm form={form} errors={errors} disabled={submitting} onChange={setField} onBlur={blurField} />
        </div>

        <OrderSummary
          flight={flight}
          originCity={cityOf(flight.origin)}
          destinationCity={cityOf(flight.destination)}
          seat={lock.seat}
          payableUntil={lock.payableUntil}
          submitting={submitting}
          canSubmit={!cancelled}
          message={message}
          onBack={() => navigate(`/flights/${flightId}`)}
          onExpire={handleExpire}
        />
      </div>
    </form>
  )
}
