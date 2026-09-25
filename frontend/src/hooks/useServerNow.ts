import { useEffect, useState } from 'react'
import { serverNowMs, useStore } from '../realtime'

// The current time by the server's clock, re-rendering the caller on an interval.
// Every expiry and countdown on screen is computed from this, never from the local clock.
export function useServerNow(intervalMs = 1000): number {
  const { state } = useStore()
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return serverNowMs(state)
}
