/**
 * Batch Client Error Logging Endpoint
 *
 * Receives batched error reports from the client-side error tracking
 * and logs them using the server-side logger for aggregation.
 *
 * This enables:
 * - Reduced server load during error spikes
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
import { ErrorBatchSchema } from '../../schemas/api-input';

const MAX_BATCH_SIZE = 100;

export default defineEventHandler(
  async (
    event,
  ): Promise<{
    success: boolean;
    processed: number;
    total: number;
    truncated: boolean;
  }> => {
    // Apply rate limiting
    const clientIp = getClientIp(event);
    const rateLimitResult = await errorEndpointRateLimiter.check(clientIp);

    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for error batch endpoint', {
        clientIp,
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });

      throw createError({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
      });
    }

    try {
      const body = await readValidatedBody(event, ErrorBatchSchema.parse);

      // Limit batch size to prevent oversized requests
      const totalReceived = body.errors.length;
      const errors = body.errors.slice(0, MAX_BATCH_SIZE);
      const truncated = totalReceived > MAX_BATCH_SIZE;

      if (errors.length === 0) {
        return { success: true, processed: 0, total: 0, truncated: false };
      }

      // Get tenant and correlation context
      const tenant = event.context.tenant;
      const correlationId = event.context.correlationId;

      // Process each error in the batch
      let processedCount = 0;
      for (const errorData of errors) {
        // Build log context
        const context: LogContext = {
          correlationId,
          hostname: tenant?.hostname,
          source: 'client',
          errorUrl: errorData.url,
          userAgent: errorData.userAgent,
          clientTimestamp: errorData.timestamp,
          batchIndex: processedCount,
          ...errorData.context,
        };

        // Create error object for logging
        const clientError = new Error(errorData.message);
        clientError.name = `Client:${errorData.name}`;
        clientError.stack = errorData.stack;

        // Log the client error
        logger.error('Client-side error (batched)', clientError, context);

        processedCount++;
      }

      // Log warning if batch was truncated
      if (truncated) {
        logger.warn('Error batch truncated', {
          received: totalReceived,
          processed: processedCount,
          limit: MAX_BATCH_SIZE,
        });
      }

      return {
        success: true,
        processed: processedCount,
        total: totalReceived,
        truncated,
      };
    } catch (error) {
      // Re-throw HTTP errors (including validation errors from readValidatedBody)
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      // Log the failure but don't expose details
      logger.warn('Failed to process client error batch', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return success anyway to prevent client retries
      return { success: true, processed: 0, total: 0, truncated: false };
    }
  },
);
