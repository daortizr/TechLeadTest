import { EventStreamProvider } from './realtime/EventStreamProvider'
import { StoreProvider } from './realtime/StoreProvider'
import Router from './Router'

export default function App() {
  return (
    <EventStreamProvider>
      <StoreProvider>
        <Router />
      </StoreProvider>
    </EventStreamProvider>
  )
}
