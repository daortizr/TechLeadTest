const STORAGE_KEY = 'flight-client-id'

// A random UUID: client ids, idempotency keys
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

let memoryId: string | null = null

// One id per browser tab (sessionStorage): it owns that tab's seat lock. Falls back to memory
// when storage is unavailable.
export function getClientId(): string {
  if (memoryId) return memoryId
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      memoryId = stored
      return stored
    }
    const created = generateId()
    sessionStorage.setItem(STORAGE_KEY, created)
    memoryId = created
    return created
  } catch {
    memoryId = generateId()
    return memoryId
  }
}
