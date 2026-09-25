export enum ErrorCode {
  // 400
  INVALID_REQUEST = 'INVALID_REQUEST',

  // 401
  UNAUTHORIZED = 'UNAUTHORIZED',

  // 402
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  PAYMENT_UNAVAILABLE = 'PAYMENT_UNAVAILABLE',

  // 403
  LOCK_NOT_OWNED = 'LOCK_NOT_OWNED',

  // 404
  SEAT_NOT_FOUND = 'SEAT_NOT_FOUND',
  FLIGHT_NOT_FOUND = 'FLIGHT_NOT_FOUND',
  RESERVATION_NOT_FOUND = 'RESERVATION_NOT_FOUND',

  // 409
  SEAT_LOCKED = 'SEAT_LOCKED',
  SEAT_RESERVED = 'SEAT_RESERVED',
  FLIGHT_NOT_BOOKABLE = 'FLIGHT_NOT_BOOKABLE',
  LOCK_EXPIRED_OR_NOT_OWNED = 'LOCK_EXPIRED_OR_NOT_OWNED',
  INVALID_TRANSITION = 'INVALID_TRANSITION',
  REQUEST_IN_PROGRESS = 'REQUEST_IN_PROGRESS',

  // 422
  IDEMPOTENCY_KEY_MISMATCH = 'IDEMPOTENCY_KEY_MISMATCH',

  // 500
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_REQUEST]: 'Solicitud inválida',
  [ErrorCode.UNAUTHORIZED]: 'Clave de administrador inválida o faltante',
  [ErrorCode.PAYMENT_DECLINED]: 'Pago rechazado',
  [ErrorCode.PAYMENT_UNAVAILABLE]: 'Pasarela de pago no disponible',
  [ErrorCode.LOCK_NOT_OWNED]: 'El asiento no está bloqueado por ti',
  [ErrorCode.SEAT_NOT_FOUND]: 'Asiento no encontrado',
  [ErrorCode.FLIGHT_NOT_FOUND]: 'Vuelo no encontrado',
  [ErrorCode.RESERVATION_NOT_FOUND]: 'Reserva no encontrada',
  [ErrorCode.SEAT_LOCKED]: 'Asiento bloqueado por otro usuario',
  [ErrorCode.SEAT_RESERVED]: 'Asiento ya vendido',
  [ErrorCode.FLIGHT_NOT_BOOKABLE]: 'Vuelo no disponible',
  [ErrorCode.LOCK_EXPIRED_OR_NOT_OWNED]: 'Bloqueo vencido o no es tuyo',
  [ErrorCode.INVALID_TRANSITION]: 'Cambio de estado inválido',
  [ErrorCode.REQUEST_IN_PROGRESS]: 'Solicitud en progreso',
  [ErrorCode.IDEMPOTENCY_KEY_MISMATCH]: 'Clave de idempotencia con contenido diferente',
  [ErrorCode.INTERNAL_ERROR]: 'Error interno del servidor'
};
