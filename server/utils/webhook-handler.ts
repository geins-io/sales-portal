import { RateLimiter } from './rate-limiter';
import { createAppError, ErrorCode } from './errors';
import {
  MAX_WEBHOOK_BODY_SIZE,
  parseSignatureHeader,
  verifyWithSecrets,
  validateTimestamp,
} from './webhook';
import {
  tenantIdKey,
  tenantConfigKey,
  collectAllHostnames,
  clearNegativeCache,
} from './tenant';
import { clearSdkCache } from '../services/_sdk';
import type { TenantConfig } from '#shared/types/tenant-config';
import { KV_STORAGE_KEYS } from '../../shared/constants/storage';
import { logger } from './logger';

const rateLimiter = new RateLimiter({ limit: 10, windowMs: 60_000 });

export interface WebhookRequest {
  clientIp: string;
  secrets: string[];
  rawBody: string | undefined;
  signatureHeader: string | undefined;
  webhookId: string | undefined;
  contentLength: number;
}

export interface KvStorage {
  getItem<T>(key: string): Promise<T | null>;
  setItem(key: string, value: unknown): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface CacheStorage {
  removeItem(key: string): Promise<void>;
}

/**
 * Core webhook handler logic for config cache invalidation.
 * Accepts plain data — no H3 dependency.
 */
export async function processConfigRefresh(
  request: WebhookRequest,
  kvStorage: KvStorage,
  cacheStorage: CacheStorage,
): Promise<{ invalidated: true }> {
  // 1. Rate limit
  const rateResult = rateLimiter.check(request.clientIp);
  if (!rateResult.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED);
  }

  // 2. Webhook secrets must be configured
  if (request.secrets.length === 0) {
    throw createAppError(
      ErrorCode.INTERNAL_ERROR,
      'Webhook secret not configured',
    );
  }

  // 3. Content-Length check
  if (request.contentLength > MAX_WEBHOOK_BODY_SIZE) {
    throw createAppError(ErrorCode.PAYLOAD_TOO_LARGE);
  }

  // 4. Raw body must be present + actual size check
  if (!request.rawBody) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Missing body');
  }

  if (Buffer.byteLength(request.rawBody, 'utf-8') > MAX_WEBHOOK_BODY_SIZE) {
    throw createAppError(ErrorCode.PAYLOAD_TOO_LARGE);
  }

  // 5. Signature header must be present
  if (!request.signatureHeader) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Missing signature header');
  }

  // 6. Parse signature header
  const parsed = parseSignatureHeader(request.signatureHeader);
  if (!parsed) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Malformed signature header');
  }

  // 7. Verify signature with key rotation support
  const signedPayload = `${parsed.timestamp}.${request.rawBody}`;
  if (!verifyWithSecrets(signedPayload, parsed.signature, request.secrets)) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Invalid webhook signature');
  }

  // 8. Timestamp replay protection
  if (!validateTimestamp(parsed.timestamp)) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Stale or missing timestamp');
  }

  // 9. Parse JSON body, extract hostname
  let body: { hostname?: string };
  try {
    body = JSON.parse(request.rawBody);
  } catch {
    throw createAppError(ErrorCode.VALIDATION_ERROR, 'Invalid JSON body');
  }

  if (!body.hostname || typeof body.hostname !== 'string') {
    throw createAppError(
      ErrorCode.VALIDATION_ERROR,
      'Missing or invalid hostname',
    );
  }

  // 10. Webhook ID must be present
  if (!request.webhookId) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Missing webhook ID');
  }

  // 11. Deduplication — check if this delivery was already processed
  const dedupKey = `${KV_STORAGE_KEYS.WEBHOOK_PROCESSED_PREFIX}${request.webhookId}`;
  const alreadyProcessed = await kvStorage.getItem(dedupKey);
  if (alreadyProcessed) {
    throw createAppError(ErrorCode.CONFLICT);
  }

  // 12. Invalidate KV storage — clean up all hostname aliases
  const hostname = body.hostname;
  const tenantId = await kvStorage.getItem<string>(tenantIdKey(hostname));
  const tid = tenantId || hostname;
  const configKey = tenantConfigKey(tid);

  // Load config to find all hostnames (primary + aliases)
  const config = await kvStorage.getItem<TenantConfig>(configKey);

  if (config) {
    // Remove all hostname → tenantId mappings
    const hostnames = collectAllHostnames(config);
    await Promise.all(
      [...hostnames].map((h) => kvStorage.removeItem(tenantIdKey(h))),
    );
  } else {
    // No config found — at least remove the mapping for this hostname
    await kvStorage.removeItem(tenantIdKey(hostname));
  }

  // Remove config under tenantId key
  await kvStorage.removeItem(configKey);

  // Also remove legacy config under hostname key if different
  if (tid !== hostname) {
    await kvStorage.removeItem(tenantConfigKey(hostname));
  }

  // 13. Invalidate in-memory caches (SDK instances + negative tenant cache)
  clearSdkCache(tid);
  clearNegativeCache(hostname);

  // 14. Invalidate Nitro handler cache
  const nitroCacheKey = `nitro:handlers:${configKey}`;
  await cacheStorage.removeItem(nitroCacheKey);

  // 15. Store webhook ID for deduplication
  await kvStorage.setItem(dedupKey, true);

  logger.info(
    `[webhook] Config cache invalidated for ${hostname} (tenantId: ${tid})`,
  );

  return { invalidated: true };
}
