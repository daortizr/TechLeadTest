// The server's clock is the reference for every countdown: the store keeps the offset
// (serverTime minus local time) and this converts it.

export function clockOffsetFrom(serverTime: string, localNow: number = Date.now()): number {
  return new Date(serverTime).getTime() - localNow
}

export function serverNow(offsetMs: number, localNow: number = Date.now()): number {
  return localNow + offsetMs
}
