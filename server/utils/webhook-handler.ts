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

const rateLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
  prefix: 'webhook',
});

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
 *
 * Security mode is determined by `request.secrets`:
 *
 * - **Signed mode** (recommended) — at least one secret is configured.
 *   Every call must carry a valid HMAC signature header and a fresh
 *   timestamp; the rate limiter (10/min/IP) is a secondary defence.
 *
 * - **Open mode** (fallback) — `request.secrets` is empty. The receiver
 *   accepts requests without signature or timestamp checks. The rate
 *   limiter and body/hostname validation still run. This exists so an
 *   environment that hasn't shipped `NUXT_WEBHOOK_SECRET` yet can still
 *   bust caches operationally instead of returning 500 on every call;
 *   set the secret in the env to upgrade to signed mode automatically.
 *
 * Open mode is a deliberate availability/security tradeoff. Set the
 * secret as soon as the env supports it.
 */
export async function processConfigRefresh(
  request: WebhookRequest,
  kvStorage: KvStorage,
  cacheStorage: CacheStorage,
): Promise<{ invalidated: true }> {
  // 1. Rate limit (always on — primary defence in open mode, secondary in signed mode)
  const rateResult = await rateLimiter.check(request.clientIp);
  if (!rateResult.allowed) {
    throw createAppError(ErrorCode.RATE_LIMITED);
  }

  const signedMode = request.secrets.length > 0;
  if (!signedMode) {
    logger.warn(
      `[webhook] No secret configured — accepting unauthenticated invalidation request from ${request.clientIp}. Set NUXT_WEBHOOK_SECRET to enforce signature verification.`,
    );
  }

  // 2. Content-Length check
  if (request.contentLength > MAX_WEBHOOK_BODY_SIZE) {
    throw createAppError(ErrorCode.PAYLOAD_TOO_LARGE);
  }

  // 3. Raw body must be present + actual size check
  if (!request.rawBody) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Missing body');
  }

  if (Buffer.byteLength(request.rawBody, 'utf-8') > MAX_WEBHOOK_BODY_SIZE) {
    throw createAppError(ErrorCode.PAYLOAD_TOO_LARGE);
  }

  // 4. Signature verification (signed mode only)
  if (signedMode) {
    if (!request.signatureHeader) {
      throw createAppError(ErrorCode.UNAUTHORIZED, 'Missing signature header');
    }

    const parsed = parseSignatureHeader(request.signatureHeader);
    if (!parsed) {
      throw createAppError(
        ErrorCode.UNAUTHORIZED,
        'Malformed signature header',
      );
    }

    const signedPayload = `${parsed.timestamp}.${request.rawBody}`;
    if (!verifyWithSecrets(signedPayload, parsed.signature, request.secrets)) {
      throw createAppError(ErrorCode.UNAUTHORIZED, 'Invalid webhook signature');
    }

    if (!validateTimestamp(parsed.timestamp)) {
      throw createAppError(
        ErrorCode.UNAUTHORIZED,
        'Stale or missing timestamp',
      );
    }
  }

  // 5. Parse JSON body, extract hostname
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

  // 6. Webhook ID required in signed mode for dedup. In open mode the
  // rate limiter is the only abuse defence, so accept calls without a
  // delivery ID — duplicates are skipped silently rather than rejected.
  const webhookId = request.webhookId;
  if (signedMode && !webhookId) {
    throw createAppError(ErrorCode.UNAUTHORIZED, 'Missing webhook ID');
  }

  // 7. Deduplication — check if this delivery was already processed.
  // Skipped entirely in open mode when the caller didn't supply an id.
  if (webhookId) {
    const dedupKey = `${KV_STORAGE_KEYS.WEBHOOK_PROCESSED_PREFIX}${webhookId}`;
    const alreadyProcessed = await kvStorage.getItem(dedupKey);
    if (alreadyProcessed) {
      throw createAppError(ErrorCode.CONFLICT);
    }
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

  // 14. Invalidate Nitro handler cache.
  // Nitro 2.x stores defineCachedEventHandler entries at:
  //   {group}:{name}:{escapeKey(getKey())}.json
  // where group="nitro/handlers", name="_" (default), and escapeKey strips
  // all non-word characters (\W). The leading /cache: base is absorbed by
  // the useStorage("cache") namespace, so the key we remove here is:
  //   nitro/handlers:_:{stripped configKey}.json
  const escapedConfigKey = configKey.replace(/\W/g, '');
  const nitroCacheKey = `nitro/handlers:_:${escapedConfigKey}.json`;
  await cacheStorage.removeItem(nitroCacheKey);

  // 12. Store webhook ID for deduplication (only when one was supplied)
  if (webhookId) {
    const dedupKey = `${KV_STORAGE_KEYS.WEBHOOK_PROCESSED_PREFIX}${webhookId}`;
    await kvStorage.setItem(dedupKey, true);
  }

  logger.info(
    `[webhook] Config cache invalidated for ${hostname} (tenantId: ${tid})`,
  );

  return { invalidated: true };
}
