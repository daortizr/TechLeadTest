import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { FlightStatus, SeatStatus } from '@flight-reservations/shared'
import type { SeatSnapshotDTO } from '@flight-reservations/shared'
import { StoreProvider, useResync, useStore } from '../../src/realtime'
import type { AppAction, AppState } from '../../src/realtime'
import { FakeEventSource } from '../setup'

let current: { state: AppState; dispatch: React.Dispatch<AppAction> }

function Probe({ onResync }: { onResync?: () => void }): null {
  current = useStore()
  useResync(onResync ?? (() => undefined))
  return null
}

const snapshot: SeatSnapshotDTO = {
  flight: {
    id: 'f1',
    code: 'AV101',
    origin: 'BOG',
    destination: 'MDE',
    departureAt: '2026-09-25T11:30:00.000Z',
    arrivalAt: '2026-09-25T12:50:00.000Z',
    price: 412000,
    currency: 'COP',
    status: FlightStatus.ON_SALE,
    version: 0
  },
  serverTime: '2026-09-25T10:00:00.000Z',
  counts: { available: 2, blocked: 0, reserved: 0, total: 2 },
  seats: [
    { seatNumber: '1A', status: SeatStatus.AVAILABLE, mine: false, version: 0 },
    { seatNumber: '1B', status: SeatStatus.AVAILABLE, mine: false, version: 0 }
  ]
}

function mount(onResync?: () => void) {
  return render(
    <StoreProvider>
      <Probe onResync={onResync} />
    </StoreProvider>
  )
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

beforeEach(() => {
  FakeEventSource.reset()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date']
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StoreProvider stream', () => {
  it('opens a single EventSource on the relative /api/events and goes live when it opens', () => {
    mount()
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.latest().url).toBe('/api/events')
    expect(current.state.connection.state).toBe('connecting')

    act(() => FakeEventSource.latest().open())
    expect(current.state.connection.state).toBe('live')
  })

  it('applies stream events to the store, batching those of the same frame', () => {
    mount()
    act(() => current.dispatch({ type: 'SNAPSHOT_LOADED', snapshot, receivedAt: 0 }))
    act(() => FakeEventSource.latest().open())

    act(() => {
      const source = FakeEventSource.latest()
      source.emit('seat.locked', { type: 'seat.locked', flightId: 'f1', seat: '1A', version: 1, lockedUntil: '2026-09-25T10:05:00.000Z' })
      source.emit('seat.reserved', { type: 'seat.reserved', flightId: 'f1', seat: '1B', version: 1 })
    })
    // Nothing yet: the frame has not run
    expect(current.state.seats.f1['1A'].status).toBe(SeatStatus.AVAILABLE)

    advance(20)
    expect(current.state.seats.f1['1A'].status).toBe(SeatStatus.BLOCKED)
    expect(current.state.seats.f1['1B'].status).toBe(SeatStatus.RESERVED)
  })

  it('ignores a malformed event without breaking the stream', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount()
    act(() => current.dispatch({ type: 'SNAPSHOT_LOADED', snapshot, receivedAt: 0 }))

    act(() => {
      const source = FakeEventSource.latest()
      source.emit('seat.locked', undefined)
      ;(source as unknown as { listeners: Map<string, ((m: { data: string }) => void)[]> }).listeners
        .get('seat.locked')
        ?.forEach((listener) => listener({ data: '{not json' }))
    })
    advance(20)

    expect(warn).toHaveBeenCalled()
    expect(current.state.seats.f1['1A'].status).toBe(SeatStatus.AVAILABLE)
    warn.mockRestore()
  })

  it('runs the screens\' resync callbacks when the stream opens, reconnects and when the tab is visible again', () => {
    const resync = vi.fn()
    mount(resync)

    act(() => FakeEventSource.latest().open())
    expect(resync).toHaveBeenCalledTimes(1)

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(resync).toHaveBeenCalledTimes(2)

    act(() => FakeEventSource.latest().fail())
    advance(1000)
    act(() => FakeEventSource.latest().open())
    expect(resync).toHaveBeenCalledTimes(3)
  })

  it('does not resync while the tab is hidden', () => {
    const resync = vi.fn()
    mount(resync)
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(resync).not.toHaveBeenCalled()
  })

  it('reconnects with a growing delay after errors and shows the reconnecting state', () => {
    mount()
    act(() => FakeEventSource.latest().open())

    act(() => FakeEventSource.latest().fail())
    expect(current.state.connection.state).toBe('reconnecting')
    expect(FakeEventSource.instances).toHaveLength(1)
    advance(999)
    expect(FakeEventSource.instances).toHaveLength(1)
    advance(1)
    expect(FakeEventSource.instances).toHaveLength(2)

    // Fails again without ever opening: the delay doubles
    act(() => FakeEventSource.latest().fail())
    advance(1999)
    expect(FakeEventSource.instances).toHaveLength(2)
    advance(1)
    expect(FakeEventSource.instances).toHaveLength(3)
  })

  it('resets the delay once a connection succeeds', () => {
    mount()
    act(() => FakeEventSource.latest().fail())
    advance(1000)
    act(() => FakeEventSource.latest().fail())
    advance(2000)
    act(() => FakeEventSource.latest().open())
    act(() => FakeEventSource.latest().fail())

    advance(1000)
    expect(FakeEventSource.instances).toHaveLength(4)
  })

  it('reopens the connection after 60 s without any message', () => {
    mount()
    act(() => FakeEventSource.latest().open())
    advance(55_000)
    expect(FakeEventSource.instances).toHaveLength(1)

    advance(10_000)
    expect(current.state.connection.state).toBe('reconnecting')
    advance(1_000)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('heartbeats keep the connection alive', () => {
    mount()
    act(() => FakeEventSource.latest().open())
    for (let i = 0; i < 6; i++) {
      advance(25_000)
      act(() => FakeEventSource.latest().emit('heartbeat'))
    }
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(current.state.connection.state).toBe('live')
  })

  it('closes the stream when the app unmounts', () => {
    const { unmount } = mount()
    const source = FakeEventSource.latest()
    unmount()
    expect(source.closed).toBe(true)
  })
})

describe('notices', () => {
  it('dismiss themselves after a few seconds', () => {
    mount()
    act(() => current.dispatch({ type: 'NOTICE_SHOWN', kind: 'warning', text: 'Tu bloqueo venció' }))
    expect(current.state.notice?.text).toBe('Tu bloqueo venció')

    advance(7_999)
    expect(current.state.notice).not.toBeNull()
    advance(1)
    expect(current.state.notice).toBeNull()
  })
})
