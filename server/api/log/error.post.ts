/**
 * Client Error Logging Endpoint
 *
 * Receives error reports from the client-side error tracking
 * and logs them using the server-side logger for aggregation.
 *
 * This enables:
 * - Centralized error logging
 * - Client error visibility in Azure Application Insights
 * - Correlation with server-side errors
 *
 * Rate limiting is applied to prevent DoS attacks via error flooding.
 * Default limit: 10 requests per minute per IP address.
 */

import { logger, type LogContext } from '../../utils/logger';
import {
  errorEndpointRateLimiter,
  getClientIp,
} from '../../utils/rate-limiter';

interface ClientErrorBody {
  message: string;
  name: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: string;
  url: string;
  userAgent: string;
}

export default defineEventHandler(
  async (event): Promise<{ success: boolean }> => {
    // Apply rate limiting
    const clientIp = getClientIp(event);
    const rateLimitResult = errorEndpointRateLimiter.check(clientIp);

    if (!rateLimitResult.allowed) {
      // Log the rate limit hit for monitoring
      logger.warn('Rate limit exceeded for error endpoint', {
        clientIp,
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });

      throw createError({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
      });
    }

    try {
      const body = await readBody<ClientErrorBody>(event);

      // Validate required fields
      if (!body || !body.message || !body.name) {
        throw createError({
          statusCode: 400,
          message: 'Invalid error report: missing required fields',
        });
      }

      // Get tenant and correlation context
      const tenant = event.context.tenant;
      const correlationId = event.context.correlationId;

      // Build log context
      const context: LogContext = {
        correlationId,
        hostname: tenant?.hostname,
        source: 'client',
        errorUrl: body.url,
        userAgent: body.userAgent,
        clientTimestamp: body.timestamp,
        ...body.context,
      };

      // Create error object for logging
      const clientError = new Error(body.message);
      clientError.name = `Client:${body.name}`;
      clientError.stack = body.stack;

      // Log the client error
      logger.error('Client-side error', clientError, context);

      // Return success
      return { success: true };
    } catch (error) {
      // Log the failure but don't expose details
      logger.warn('Failed to process client error report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return success anyway to prevent client retries
      return { success: true };
    }
  },
);
