import React, { useEffect, useRef, useContext } from 'react'
import { setClockOffset } from '../lib/clock'

interface EventStreamContextType {
  subscribe: (callback: (event: any) => void) => () => void
}

const EventStreamContext = React.createContext<EventStreamContextType | null>(null)

export function useEventStream() {
  const ctx = useContext(EventStreamContext)
  if (!ctx) throw new Error('useEventStream must be used within EventStreamProvider')
  return ctx
}

export function EventStreamProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<(event: any) => void>>(new Set())
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

      es.addEventListener('seat.locked', (e: any) => {
        const data = JSON.parse(e.data)
        // Set clock offset from first event
        if (data.lockedUntil && !sessionStorage.getItem('clock-set')) {
          setClockOffset(data.lockedUntil)
          sessionStorage.setItem('clock-set', 'true')
        }
        listenersRef.current.forEach(cb => cb(data))
      })

      es.addEventListener('seat.released', (e: any) => {
        listenersRef.current.forEach(cb => cb(JSON.parse(e.data)))
      })

      es.addEventListener('seat.reserved', (e: any) => {
        listenersRef.current.forEach(cb => cb(JSON.parse(e.data)))
      })

      es.addEventListener('flight.updated', (e: any) => {
        listenersRef.current.forEach(cb => cb(JSON.parse(e.data)))
      })

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
