import React, { useReducer, useContext, useEffect } from 'react'
import { appReducer } from './reducer'
import { AppState, AppAction } from './types'
import { useEventStream } from './EventStreamProvider'

interface StoreContextType {
  state: AppState
  dispatch: (action: AppAction) => void
}

const StoreContext = React.createContext<StoreContextType | null>(null)

export function useStore(): StoreContextType {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function StoreProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [state, dispatch] = useReducer(appReducer, {
    connection: { state: 'connecting', lastMessageAt: null },
    clockOffsetMs: 0,
    flights: {},
    seats: {},
    myLock: {},
    activity: {},
  } as AppState)

  const eventStream = useEventStream()

  useEffect(() => {
    dispatch({ type: 'CONNECTION_LIVE' })

    const unsubscribe = eventStream.subscribe((event) => {
      dispatch({ type: 'EVENT', event })
    })

    return unsubscribe
  }, [eventStream])

  const value: StoreContextType = { state, dispatch }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
