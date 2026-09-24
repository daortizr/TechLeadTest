const BOGOTA_TZ = 'America/Bogota'

export function formatPrice(cents: number, currency = 'COP'): string {
  const formatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  })
  return formatter.format(cents / 100)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date

  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return formatter.format(d)
}

export function formatDateOnly(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date

  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(d)
}

export function formatTimeOnly(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date

  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  })

  return formatter.format(d)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
