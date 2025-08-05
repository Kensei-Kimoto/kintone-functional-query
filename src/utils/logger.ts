/**
 * Structured logging utility for kintone-functional-query
 */
export interface LogContext {
  module?: string;
  function?: string;
  field?: string;
  operator?: string;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Simple structured logger that respects environment settings
 */
export class Logger {
  private static isDebugMode(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
  }

  private static shouldLog(level: LogLevel): boolean {
    if (level === 'error') return true;
    if (level === 'warn') return true;
    if (level === 'info') return this.isDebugMode();
    if (level === 'debug') return this.isDebugMode();
    return false;
  }

  private static formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const prefix = `[kintone-query:${level.toUpperCase()}]`;
    if (!context) return `${prefix} ${message}`;
    
    const contextStr = Object.entries(context)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    
    return contextStr ? `${prefix} ${message} (${contextStr})` : `${prefix} ${message}`;
  }

  static debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  static info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  static warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  static error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }
}

/**
 * Validation warning helper
 */
export function logValidationWarning(
  message: string,
  error: unknown,
  context?: LogContext
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  Logger.warn(`${message}: ${errorMessage}`, context);
}

/**
 * Compatibility warning helper for deprecated features
 */
export function logCompatibilityWarning(
  feature: string,
  recommendation?: string,
  context?: LogContext
): void {
  const message = recommendation 
    ? `${feature} は非推奨です。${recommendation}を使用してください`
    : `${feature} は非推奨です`;
  Logger.warn(message, context);
}