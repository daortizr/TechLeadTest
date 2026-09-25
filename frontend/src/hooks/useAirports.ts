import { useEffect, useState } from 'react'
import type { AirportDTO } from '@flight-reservations/shared'
import { api } from '../api/client'

// One request for the whole session: airports do not change while the app is open
let cached: Promise<AirportDTO[]> | null = null

function loadAirports(): Promise<AirportDTO[]> {
  if (!cached) {
    cached = api.airports.list().catch((error: unknown) => {
      cached = null
      throw error
    })
  }
  return cached
}

// null while loading or if it failed: callers fall back to the airport codes
export function useAirports(): AirportDTO[] | null {
  const [airports, setAirports] = useState<AirportDTO[] | null>(null)

  useEffect(() => {
    let active = true
    loadAirports()
      .then((list) => active && setAirports(list))
      .catch((error: unknown) => console.warn('Could not load airports', error))
    return () => {
      active = false
    }
  }, [])

  return airports
}
