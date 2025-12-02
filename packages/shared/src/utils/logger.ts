// Logging utilities

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create a simple structured logger
 */
export function createLogger(
  name: string,
  minLevel: LogLevel = 'info',
  baseContext: Record<string, unknown> = {}
): Logger {
  const minLevelNum = LOG_LEVELS[minLevel];

  function log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (LOG_LEVELS[level] < minLevelNum) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: { ...baseContext, ...context, logger: name },
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
    child: (ctx) => createLogger(name, minLevel, { ...baseContext, ...ctx }),
  };
}

/**
 * Global logger instance
 */
export const logger = createLogger(
  'entropy',
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);
