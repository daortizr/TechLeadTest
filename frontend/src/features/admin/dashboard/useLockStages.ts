import { useCallback, useEffect, useRef, useState } from 'react'
import type { LockStagesDTO } from '@flight-reservations/shared'
import { api } from '../../../api/client'
import { useResync } from '../../../realtime'

const DEBOUNCE_MS = 1000

interface UseLockStages {
  stages: LockStagesDTO | null
  failed: boolean
}

// Active locks by stage (selecting / paying), from the admin endpoint. It reloads on
// (re)connection and, one second after the last seat event of the flight arrives.
// `changeToken` changes whenever an event of this flight is recorded.
export function useLockStages(flightId: string, changeToken: number | null): UseLockStages {
  const [stages, setStages] = useState<LockStagesDTO | null>(null)
  const [failed, setFailed] = useState(false)
  const counter = useRef(0)

  const load = useCallback(() => {
    const requestId = ++counter.current
    api.admin
      .lockStages(flightId)
      .then((result) => {
        if (requestId !== counter.current) return
        setStages(result)
        setFailed(false)
      })
      .catch((error: unknown) => {
        if (requestId !== counter.current) return
        console.warn('Could not load the lock stages', error)
        setFailed(true)
      })
  }, [flightId])

  useEffect(() => {
    setStages(null)
    load()
    return () => {
      counter.current += 1
    }
  }, [load])

  useResync(load)

  useEffect(() => {
    if (changeToken === null) return
    const timer = setTimeout(load, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [changeToken, load])

  return { stages, failed }
}
