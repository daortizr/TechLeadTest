import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

type Listener = (event: MessageEvent<string>) => void

// A controllable EventSource: tests decide when it opens and which events arrive
export class FakeEventSource {
  static instances: FakeEventSource[] = []
  static reset(): void {
    FakeEventSource.instances = []
  }
  static latest(): FakeEventSource {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1]
  }

  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  private listeners = new Map<string, Listener[]>()

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  close(): void {
    this.closed = true
  }

  open(): void {
    this.onopen?.()
  }

  emit(type: string, payload: unknown = {}): void {
    const message = { data: JSON.stringify(payload) } as MessageEvent<string>
    this.listeners.get(type)?.forEach((listener) => listener(message))
  }

  fail(): void {
    this.onerror?.()
  }
}

Object.defineProperty(globalThis, 'EventSource', { value: FakeEventSource, writable: true, configurable: true })
