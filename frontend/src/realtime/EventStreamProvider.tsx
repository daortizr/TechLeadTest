import React, { useEffect, useRef, useContext } from 'react'
import { setClockOffset } from '../lib/clock'
import { FlightEvent } from '@flight-reservations/shared'

interface EventStreamContextType {
  subscribe: (callback: (event: FlightEvent) => void) => () => void
}

const EventStreamContext = React.createContext<EventStreamContextType | null>(null)

export function useEventStream(): EventStreamContextType {
  const ctx = useContext(EventStreamContext)
  if (!ctx) throw new Error('useEventStream must be used within EventStreamProvider')
  return ctx
}

export function EventStreamProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const listenersRef = useRef<Set<(event: FlightEvent) => void>>(new Set())
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageTimeRef = useRef<Date>(new Date())
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      const es = new EventSource('/api/events')

      es.addEventListener('open', () => {
        console.log('SSE connected')
        lastMessageTimeRef.current = new Date()
      })

      es.addEventListener('heartbeat', () => {
        lastMessageTimeRef.current = new Date()
      })

      const handleMessage = (eventType: string) => (e: Event) => {
        if (e instanceof MessageEvent) {
          const data: FlightEvent = JSON.parse((e as MessageEvent).data)
          // Set clock offset from first event
          if ('lockedUntil' in data && data.lockedUntil && !sessionStorage.getItem('clock-set')) {
            setClockOffset(data.lockedUntil)
            sessionStorage.setItem('clock-set', 'true')
          }
          listenersRef.current.forEach(cb => cb(data))
        }
      }

      es.addEventListener('seat.locked', handleMessage('seat.locked'))
      es.addEventListener('seat.released', handleMessage('seat.released'))
      es.addEventListener('seat.reserved', handleMessage('seat.reserved'))
      es.addEventListener('flight.updated', handleMessage('flight.updated'))

      es.onerror = () => {
        console.error('SSE error, reconnecting...')
        es.close()
        eventSourceRef.current = null

        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      eventSourceRef.current = es

      // Check for inactivity every 60 seconds
      inactivityCheckRef.current = setInterval(() => {
        const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current.getTime()
        if (timeSinceLastMessage > 60000) {
          console.warn('No SSE message for 60s, reconnecting...')
          connect()
        }
      }, 60000)
    }

    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (inactivityCheckRef.current) {
        clearInterval(inactivityCheckRef.current)
      }
    }
  }, [])

  const value: EventStreamContextType = {
    subscribe: (callback) => {
      listenersRef.current.add(callback)
      return () => {
        listenersRef.current.delete(callback)
      }
    },
  }

  return (
    <EventStreamContext.Provider value={value}>
      {children}
    </EventStreamContext.Provider>
  )
}
