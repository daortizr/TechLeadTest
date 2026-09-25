import pino from 'pino';
import { Logger as LoggerPort } from '../outputPorts';

const SENSITIVE_KEYS = [
  'cardNumber',
  'cvv',
  'expiry',
  'holderName',
  'payment',
  'password',
  'authorization_ref',
  'authorizationRef',
  'lockedBy',
  'locked_by',
  'documentNumber',
  'phone',
  'email',
  'passenger'
];

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [...SENSITIVE_KEYS, ...SENSITIVE_KEYS.map((key) => `*.${key}`)],
    censor: '[REDACTED]'
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false
    }
  }
});

export const logger: LoggerPort = {
  info: (message, data) => pinoLogger.info(data, message),
  error: (message, data) => pinoLogger.error(data, message),
  warn: (message, data) => pinoLogger.warn(data, message),
  debug: (message, data) => pinoLogger.debug(data, message)
};
