const BOGOTA_TZ = 'America/Bogota'

// price is in whole pesos (COP has no minor unit in use)
export function formatPrice(price: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value
}

// 24-hour clock in Bogotá, e.g. "06:30"
export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(toDate(value))
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(toDate(value))
}

// "AV101" reads better as "AV 101"
export function formatFlightCode(code: string): string {
  return code.replace(/^([A-Za-z]+)(\d+)$/, '$1 $2')
}

const SHORT_MONTHS =['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "25 sep" from a YYYY-MM-DD calendar date (a plain date: no time zone involved)
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number)
  return `${day} ${SHORT_MONTHS[month - 1]}`
}

// "Vie 25 sep · 06:30" for a flight's departure, in Bogotá time
export function formatDeparture(value: string | Date): string {
  const date = toDate(value)
  const parts = new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA_TZ, weekday: 'short', day: 'numeric' }).formatToParts(date)
  const weekday = (parts.find((part) => part.type === 'weekday')?.value ?? '').replace('.', '')
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TZ, month: '2-digit' }).format(date)
  const label = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${SHORT_MONTHS[Number(month) - 1]}`
  return `${label} · ${formatTime(date)}`
}

// Today in Bogotá as YYYY-MM-DD, plus an offset in days
export function bogotaDate(daysFromToday = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
  const [year, month, day] = parts.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + daysFromToday)).toISOString().slice(0, 10)
}

// "4:07" for a countdown
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
