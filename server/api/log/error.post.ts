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
 */

import { logger, type LogContext } from '../../utils/logger';

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
        tenantId: tenant?.id,
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
