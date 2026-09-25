import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { getClientId } from '../../lib/clientId'
import { SEAT_LABELS } from '../../lib/labels'
import { useStore } from '../../realtime'

interface UseSeatSelection {
  // An action is in progress: the map ignores further clicks until it ends
  busy: boolean
  select: (seat: string) => Promise<void>
  release: () => Promise<void>
  continueToPayment: () => Promise<void>
}

// Lock, release and checkout for the seat map. Errors become short notices, and whenever the
// server disagrees with what the screen showed, the map reloads from the database.
export function useSeatSelection(flightId: string, reload: () => void): UseSeatSelection {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const myLock = state.myLock[flightId] ?? null

  const notify = useCallback(
    (text: string) => dispatch({ type: 'NOTICE_SHOWN', kind: 'warning', text }),
    [dispatch]
  )

  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) {
        notify(SEAT_LABELS.notices.generic)
        return
      }
      switch (error.code) {
        case 'SEAT_LOCKED':
          notify(SEAT_LABELS.notices.taken)
          break
        case 'SEAT_RESERVED':
          notify(SEAT_LABELS.notices.sold)
          break
        case 'FLIGHT_NOT_BOOKABLE':
          notify(SEAT_LABELS.notices.notBookable)
          break
        case 'LOCK_EXPIRED_OR_NOT_OWNED':
          dispatch({ type: 'MY_LOCK_SET', flightId, lock: null })
          notify(SEAT_LABELS.notices.lockExpired)
          break
        case 'NETWORK':
          notify(SEAT_LABELS.notices.network)
          return
        default:
          notify(SEAT_LABELS.notices.generic)
      }
      // The database is the source of truth: show what really happened
      reload()
    },
    [dispatch, flightId, notify, reload]
  )

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true)
      try {
        await action()
      } catch (error) {
        handleError(error)
      } finally {
        setBusy(false)
      }
    },
    [handleError]
  )

  const select = useCallback(
    (seat: string) =>
      run(async () => {
        const clientId = getClientId()
        // Pressing my own seat again gives it up
        if (myLock?.seat === seat) {
          await api.seats.unlock(flightId, seat, clientId)
          dispatch({ type: 'MY_LOCK_SET', flightId, lock: null })
          return
        }
        const lock = await api.seats.lock(flightId, seat, clientId)
        dispatch({
          type: 'MY_LOCK_SET',
          flightId,
          lock: { seat: lock.seat, lockedUntil: lock.lockedUntil, payableUntil: null }
        })
      }),
    [dispatch, flightId, myLock, run]
  )

  const release = useCallback(
    () =>
      run(async () => {
        if (!myLock) return
        await api.seats.unlock(flightId, myLock.seat, getClientId())
        dispatch({ type: 'MY_LOCK_SET', flightId, lock: null })
      }),
    [dispatch, flightId, myLock, run]
  )

  // Checkout restarts the lock once (idempotent afterwards) and opens the payment screen
  const continueToPayment = useCallback(
    () =>
      run(async () => {
        if (!myLock) return
        const checkout = await api.seats.checkout(flightId, myLock.seat, getClientId())
        dispatch({
          type: 'MY_LOCK_SET',
          flightId,
          lock: { seat: myLock.seat, lockedUntil: checkout.lockedUntil, payableUntil: checkout.payableUntil }
        })
        navigate(`/flights/${flightId}/checkout`)
      }),
    [dispatch, flightId, myLock, navigate, run]
  )

  return { busy, select, release, continueToPayment }
}
