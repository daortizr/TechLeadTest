import { useEffect, useRef, useState } from 'react'

// Passes `value` on at most once per `intervalMs`. Live regions use it so a screen reader
// hears a fast-changing summary (occupancy counts) no more than once a second.
export function useThrottledValue<T>(value: T, intervalMs = 1000): T {
  const [throttled, setThrottled] = useState(value)
  const lastAt = useRef(0)

  useEffect(() => {
    const wait = Math.max(0, intervalMs - (Date.now() - lastAt.current))
    const timer = setTimeout(() => {
      lastAt.current = Date.now()
      setThrottled(value)
    }, wait)
    return () => clearTimeout(timer)
  }, [value, intervalMs])

  return throttled
}
