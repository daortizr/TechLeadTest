import { ErrorCode } from '@flight-reservations/shared';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly statusCode: number = 500,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details })
      }
    };
  }

  static badRequest(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 400, details);
  }

  static paymentDeclined(details?: Record<string, unknown>) {
    return new AppError(ErrorCode.PAYMENT_DECLINED, 'Pago rechazado', 402, details);
  }

  static paymentUnavailable(details?: Record<string, unknown>) {
    return new AppError(ErrorCode.PAYMENT_UNAVAILABLE, 'Pasarela no disponible', 503, details);
  }

  static forbidden(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 403, details);
  }

  static notFound(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 404, details);
  }

  static conflict(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 409, details);
  }

  static unprocessableEntity(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 422, details);
  }

  static internal(message: string = 'Error interno del servidor', details?: Record<string, unknown>) {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, details);
  }
}
