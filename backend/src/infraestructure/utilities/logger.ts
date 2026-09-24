import pino from 'pino';
import { Logger as LoggerPort } from '../outputPorts';

const pinoLogger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false
    }
  }
});

// Redact sensitive information
pinoLogger.setBindings({
  redact: ['cardNumber', 'cvv', 'authorization_ref', 'password']
});

export const logger: LoggerPort = {
  info: (message, data) => pinoLogger.info(data, message),
  error: (message, data) => pinoLogger.error(data, message),
  warn: (message, data) => pinoLogger.warn(data, message),
  debug: (message, data) => pinoLogger.debug(data, message)
};
