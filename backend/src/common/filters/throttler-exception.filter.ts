import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Custom exception filter for rate limiting (throttler) errors
 *
 * Provides user-friendly error messages instead of generic "Too Many Requests"
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Determine user-friendly message based on the endpoint
    let message = 'Too many requests. Please try again later.';
    let retryAfter = 60; // Default 1 minute

    const path = request.url;

    if (path.includes('/login')) {
      message =
        'Too many login attempts. Please wait 1 minute before trying again.';
      retryAfter = 60;
    } else if (path.includes('/register')) {
      message =
        'Too many registration attempts. Please wait 5 minutes before trying again.';
      retryAfter = 300;
    } else if (path.includes('/refresh')) {
      message = 'Too many token refresh requests. Please wait 1 minute.';
      retryAfter = 60;
    } else if (path.includes('/auth')) {
      message =
        'Too many authentication requests. Please slow down and try again in a moment.';
      retryAfter = 60;
    }

    response.status(429).header('Retry-After', retryAfter.toString()).json({
      success: false,
      statusCode: 429,
      message,
      error: 'Rate Limit Exceeded',
      retryAfter,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
