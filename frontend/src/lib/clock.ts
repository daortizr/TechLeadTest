// Calculate offset between client time and server time
let clockOffsetMs = 0

export function setClockOffset(serverTime: string): void {
  const serverDate = new Date(serverTime)
  const clientDate = new Date()
  clockOffsetMs = serverDate.getTime() - clientDate.getTime()
}

export function now(): Date {
  return new Date(Date.now() + clockOffsetMs)
}

export function getClockOffset(): number {
  return clockOffsetMs
}
