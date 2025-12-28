/**
 * Provides a consistent log format with support for levels and categories.
 */

/** Logging level */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Logger creation options */
interface LoggerOptions {
  /** Whether the logger is enabled (defaults depend on DEV mode) */
  enabled?: boolean;
  /** Minimum logging level */
  minLevel?: LogLevel;
}

/** Logging level priorities */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Global flag — logs are enabled only in DEV mode */
const DEBUG = import.meta.env.DEV;

/** Returns a timestamp in HH:MM:SS.mmm format */
function getTimestamp(): string {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

/** Formats a log message with a timestamp and a level icon */
function formatMessage(category: string, level: LogLevel, message: string): string {
  const levelIcons: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };
  return `[${getTimestamp()}] ${levelIcons[level]} [${category}] ${message}`;
}

/** Logger interface */
export interface Logger {

  debug(message: string, data?: unknown): void;

  info(message: string, data?: unknown): void;

  warn(message: string, data?: unknown): void;

  error(message: string, error?: unknown): void;
}

/**
 * Creates a logger for a module with the given category.
 * 
 * @param category - Short module name
 * @param options - Logger options (enabled, minLevel)
 * @returns Logger object with debug, info, warn, error methods
 * 
 * @example
 * const log = createLogger('BG');
 * log.info('Extension started');
 * log.debug('State updated', { initialized: true });
 * log.error('Failed to decrypt', error);
 *
 * @remarks
 * By default, logs are enabled only in DEV mode.
 */
export function createLogger(category: string, options: LoggerOptions = {}): Logger {
  const { enabled = DEBUG, minLevel = 'debug' } = options;

  const shouldLog = (level: LogLevel): boolean => {
    return enabled && LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
  };

  return {
    debug(message: string, data?: unknown) {
      if (shouldLog('debug')) {
        if (data !== undefined) {
          console.log(formatMessage(category, 'debug', message), data);
        } else {
          console.log(formatMessage(category, 'debug', message));
        }
      }
    },

    info(message: string, data?: unknown) {
      if (shouldLog('info')) {
        if (data !== undefined) {
          console.info(formatMessage(category, 'info', message), data);
        } else {
          console.info(formatMessage(category, 'info', message));
        }
      }
    },

    warn(message: string, data?: unknown) {
      if (shouldLog('warn')) {
        if (data !== undefined) {
          console.warn(formatMessage(category, 'warn', message), data);
        } else {
          console.warn(formatMessage(category, 'warn', message));
        }
      }
    },

    error(message: string, error?: unknown) {
      if (shouldLog('error')) {
        if (error !== undefined) {
          console.error(formatMessage(category, 'error', message), error);
        } else {
          console.error(formatMessage(category, 'error', message));
        }
      }
    },
  };
}
