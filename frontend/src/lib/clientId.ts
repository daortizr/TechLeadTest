// Generate or retrieve client ID from sessionStorage
export function getClientId(): string {
  const STORAGE_KEY = 'flight-client-id'

  let clientId = sessionStorage.getItem(STORAGE_KEY)

  if (!clientId) {
    // Simple UUID v4 generation
    clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    sessionStorage.setItem(STORAGE_KEY, clientId)
  }

  return clientId
}
