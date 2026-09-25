import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { FlightEvent } from '@flight-reservations/shared'
import { API_BASE } from '../api/client'
import { appReducer, initialState } from './reducer'
import type { AppAction, AppState } from './types'

const SILENCE_LIMIT_MS = 60_000
const WATCHDOG_INTERVAL_MS = 5_000
const RECONNECT_MIN_MS = 1_000
const RECONNECT_MAX_MS = 10_000
const NOTICE_DURATION_MS = 8_000

const STREAM_EVENTS = ['seat.locked', 'seat.released', 'seat.reserved', 'flight.updated'] as const

interface StoreContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  // Registers a callback that reloads what the screen shows; the store calls it whenever
  // the stream (re)opens and when the tab becomes visible again.
  registerResync: (callback: () => void) => () => void
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

export function useStore(): { state: AppState; dispatch: React.Dispatch<AppAction> } {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used within StoreProvider')
  return { state: context.state, dispatch: context.dispatch }
}

// Reload data on (re)connection and when the tab returns to the foreground.
// The database is the source of truth; events only notify.
export function useResync(callback: () => void): void {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useResync must be used within StoreProvider')
  const { registerResync } = context
  const latest = useRef(callback)
  latest.current = callback

  useEffect(() => registerResync(() => latest.current()), [registerResync])
}

export function StoreProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const resyncCallbacks = useRef<Set<() => void>>(new Set())

  const registerResync = useCallback((callback: () => void) => {
    resyncCallbacks.current.add(callback)
    return () => {
      resyncCallbacks.current.delete(callback)
    }
  }, [])

  useEffect(() => {
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectDelay = RECONNECT_MIN_MS
    let lastMessageAt = Date.now()
    let stopped = false
    let pending: FlightEvent[] = []
    let frame: number | null = null

    const runResync = () => resyncCallbacks.current.forEach((callback) => callback())

    // Events of the same frame are applied together in a single render
    const flush = () => {
      frame = null
      if (pending.length === 0) return
      const events = pending
      pending = []
      dispatch({ type: 'EVENTS_RECEIVED', events, receivedAt: Date.now() })
    }

    const touch = () => {
      lastMessageAt = Date.now()
      dispatch({ type: 'MESSAGE_RECEIVED', at: lastMessageAt })
    }

    const close = () => {
      source?.close()
      source = null
    }

    const scheduleReconnect = () => {
      dispatch({ type: 'CONNECTION_CHANGED', state: 'reconnecting' })
      if (reconnectTimer) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, reconnectDelay)
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
    }

    const connect = () => {
      if (stopped) return
      close()
      source = new EventSource(`${API_BASE}/events`)

      source.onopen = () => {
        reconnectDelay = RECONNECT_MIN_MS
        lastMessageAt = Date.now()
        dispatch({ type: 'CONNECTION_CHANGED', state: 'live' })
        touch()
        runResync()
      }

      source.addEventListener('heartbeat', touch)

      for (const type of STREAM_EVENTS) {
        source.addEventListener(type, (message) => {
          touch()
          try {
            pending.push(JSON.parse((message as MessageEvent<string>).data) as FlightEvent)
          } catch (error) {
            console.warn('Ignoring a malformed stream event', error)
            return
          }
          if (frame === null) frame = requestAnimationFrame(flush)
        })
      }

      source.onerror = () => {
        close()
        scheduleReconnect()
      }
    }

    // No message (not even a heartbeat) for 60 s: the connection is dead, reopen it
    const watchdog = setInterval(() => {
      if (Date.now() - lastMessageAt > SILENCE_LIMIT_MS) {
        lastMessageAt = Date.now()
        close()
        scheduleReconnect()
      }
    }, WATCHDOG_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') runResync()
    }
    document.addEventListener('visibilitychange', onVisibility)

    connect()

    return () => {
      stopped = true
      close()
      clearInterval(watchdog)
      document.removeEventListener('visibilitychange', onVisibility)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  // Temporary notices dismiss themselves
  useEffect(() => {
    if (!state.notice) return
    const { id } = state.notice
    const timer = setTimeout(() => dispatch({ type: 'NOTICE_DISMISSED', id }), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [state.notice])

  const value = useMemo(() => ({ state, dispatch, registerResync }), [state, registerResync])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
