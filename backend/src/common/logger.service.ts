import { Injectable } from '@nestjs/common';

interface LogContext {
  [key: string]: any;
}

@Injectable()
export class LoggerService {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  /**
   * Log info level messages (only in development)
   */
  info(namespace: string, message: string, context?: LogContext) {
    if (this.isDevelopment) {
      const timestamp = new Date().toISOString();
      const ctx = context ? ` | ${JSON.stringify(context)}` : '';
      console.log(`[${timestamp}] ℹ️  [${namespace}] ${message}${ctx}`);
    }
  }

  /**
   * Log success messages (only in development)
   */
  success(namespace: string, message: string, context?: LogContext) {
    if (this.isDevelopment) {
      const timestamp = new Date().toISOString();
      const ctx = context ? ` | ${JSON.stringify(context)}` : '';
      console.log(`[${timestamp}] ✅ [${namespace}] ${message}${ctx}`);
    }
  }

  /**
   * Log warning messages (always)
   */
  warn(namespace: string, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` | ${JSON.stringify(context)}` : '';
    console.warn(`[${timestamp}] ⚠️  [${namespace}] ${message}${ctx}`);
  }

  /**
   * Log error messages (always)
   */
  error(namespace: string, message: string, error?: Error | any) {
    const timestamp = new Date().toISOString();
    const errorInfo =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
    const ctx = errorInfo ? ` | ${JSON.stringify(errorInfo)}` : '';
    console.error(`[${timestamp}] ❌ [${namespace}] ${message}${ctx}`);
  }

  /**
   * Log debug messages (only in development)
   */
  debug(namespace: string, message: string, context?: LogContext) {
    if (this.isDevelopment) {
      const timestamp = new Date().toISOString();
      const ctx = context ? ` | ${JSON.stringify(context)}` : '';
      console.log(`[${timestamp}] 🔍 [${namespace}] ${message}${ctx}`);
    }
  }
}
