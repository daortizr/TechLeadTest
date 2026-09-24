import { describe, it, expect } from 'vitest'
import { AppError } from '../../src/application/errorHandler/AppError'
import { ErrorCode } from '@flight-reservations/shared'

describe('AppError', () => {
  it('should create error with default status code', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error')

    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
  })

  it('should create error with custom status code', () => {
    const error = new AppError(ErrorCode.SEAT_ALREADY_LOCKED, 'Seat locked', 409)

    expect(error.statusCode).toBe(409)
    expect(error.code).toBe(ErrorCode.SEAT_ALREADY_LOCKED)
  })

  it('should include details in error', () => {
    const details = { flightId: 'flight-1', seat: '1A' }
    const error = new AppError(ErrorCode.SEAT_NOT_FOUND, 'Seat not found', 404, details)

    expect(error.details).toEqual(details)
  })

  it('should serialize to JSON correctly', () => {
    const error = new AppError(ErrorCode.PAYMENT_DECLINED, 'Payment declined', 402)
    const json = error.toJSON()

    expect(json.error.code).toBe(ErrorCode.PAYMENT_DECLINED)
    expect(json.error.message).toBe('Payment declined')
    expect(json.error.details).toBeUndefined()
  })

  it('should serialize with details to JSON', () => {
    const details = { reason: 'Insufficient funds' }
    const error = new AppError(ErrorCode.PAYMENT_DECLINED, 'Payment declined', 402, details)
    const json = error.toJSON()

    expect(json.error.details).toEqual(details)
  })

  it('should create badRequest error', () => {
    const error = AppError.badRequest(ErrorCode.INVALID_INPUT, 'Invalid input data')

    expect(error.statusCode).toBe(400)
    expect(error.code).toBe(ErrorCode.INVALID_INPUT)
  })

  it('should create paymentDeclined error', () => {
    const error = AppError.paymentDeclined()

    expect(error.statusCode).toBe(402)
    expect(error.code).toBe(ErrorCode.PAYMENT_DECLINED)
    expect(error.message).toBe('Pago rechazado')
  })

  it('should create paymentUnavailable error', () => {
    const error = AppError.paymentUnavailable()

    expect(error.statusCode).toBe(503)
    expect(error.code).toBe(ErrorCode.PAYMENT_UNAVAILABLE)
    expect(error.message).toBe('Pasarela no disponible')
  })

  it('should create forbidden error', () => {
    const error = AppError.forbidden(ErrorCode.UNAUTHORIZED, 'Not authorized')

    expect(error.statusCode).toBe(403)
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED)
  })

  it('should create notFound error', () => {
    const error = AppError.notFound(ErrorCode.FLIGHT_NOT_FOUND, 'Flight not found')

    expect(error.statusCode).toBe(404)
    expect(error.code).toBe(ErrorCode.FLIGHT_NOT_FOUND)
  })

  it('should create conflict error', () => {
    const error = AppError.conflict(ErrorCode.SEAT_ALREADY_LOCKED, 'Seat already locked')

    expect(error.statusCode).toBe(409)
    expect(error.code).toBe(ErrorCode.SEAT_ALREADY_LOCKED)
  })

  it('should create unprocessableEntity error', () => {
    const error = AppError.unprocessableEntity(ErrorCode.INVALID_REQUEST, 'Invalid data')

    expect(error.statusCode).toBe(422)
    expect(error.code).toBe(ErrorCode.INVALID_REQUEST)
  })

  it('should create internal error with default message', () => {
    const error = AppError.internal()

    expect(error.statusCode).toBe(500)
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(error.message).toBe('Error interno del servidor')
  })

  it('should create internal error with custom message', () => {
    const error = AppError.internal('Custom error message')

    expect(error.statusCode).toBe(500)
    expect(error.message).toBe('Custom error message')
  })

  it('should be instanceof Error', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test')

    expect(error instanceof Error).toBe(true)
    expect(error.name).toBe('AppError')
  })

  it('should preserve stack trace', () => {
    const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error')

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('AppError.test.ts')
  })
})
