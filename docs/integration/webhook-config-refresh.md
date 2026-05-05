# Webhook: Config Cache Refresh

When a merchant publishes config changes in Geins Studio, fire this webhook to invalidate the cached tenant configuration immediately.

## Endpoint

```
POST /api/internal/webhook/config-refresh
```

## Headers

| Header                | Required | Description                                                     |
| --------------------- | -------- | --------------------------------------------------------------- |
| `x-webhook-signature` | Yes      | Stripe-style signature: `t=<unix_seconds>,v1=<hex_hmac>`        |
| `x-webhook-id`        | Yes      | Unique delivery ID (UUID recommended). Duplicates are rejected. |
| `content-type`        | Yes      | `application/json`                                              |

## Body

```json
{ "hostname": "tenant-a.litium.portal" }
```

- `hostname` (string, required) — the tenant hostname whose config changed
- Max body size: **64 KB**

## Signing

The signature uses HMAC-SHA256 with a shared secret (`NUXT_WEBHOOK_SECRET`).

### Step by step

1. Get the current Unix timestamp in **seconds** (not milliseconds)
2. Build the signed payload: `"${timestamp}.${rawJsonBody}"`
3. Compute HMAC-SHA256 of the signed payload using the shared secret
4. Format the header: `t=${timestamp},v1=${hexDigest}`

### Node.js example

```javascript
import { createHmac, randomUUID } from 'node:crypto';

function sendConfigRefresh(webhookUrl, hostname, secret) {
  const body = JSON.stringify({ hostname });
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': `t=${timestamp},v1=${signature}`,
      'x-webhook-id': randomUUID(),
    },
    body,
  });
}
```

### curl example

```bash
SECRET="your-shared-secret"
HOSTNAME="tenant-a.litium.portal"
BODY="{\"hostname\":\"$HOSTNAME\"}"
TIMESTAMP=$(date +%s)
SIGNED_PAYLOAD="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$SIGNED_PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')

curl -X POST https://your-portal-domain.com/api/internal/webhook/config-refresh \
  -H "content-type: application/json" \
  -H "x-webhook-signature: t=${TIMESTAMP},v1=${SIGNATURE}" \
  -H "x-webhook-id: $(uuidgen)" \
  -d "$BODY"
```

## Key Rotation

The receiver supports comma-separated secrets:

```
NUXT_WEBHOOK_SECRET=new_key,old_key
```

It tries each key in order and accepts on the first match. To rotate without downtime:

1. **Add** new key on the receiver: `NUXT_WEBHOOK_SECRET=new_key,old_key`
2. **Switch** the sender to sign with `new_key`
3. **Remove** old key from the receiver: `NUXT_WEBHOOK_SECRET=new_key`

## Responses

| Status  | Meaning                   | When                                                                                  |
| ------- | ------------------------- | ------------------------------------------------------------------------------------- |
| **200** | `{ "invalidated": true }` | Config cache cleared successfully                                                     |
| **401** | Unauthorized              | Missing/invalid signature, missing body, missing webhook ID, stale timestamp (>5 min) |
| **409** | Conflict                  | This `x-webhook-id` was already processed (duplicate delivery)                        |
| **413** | Payload Too Large         | Body exceeds 64 KB                                                                    |
| **422** | Validation Error          | Missing or invalid `hostname` in body                                                 |
| **429** | Rate Limited              | More than 10 requests/minute from the same IP                                         |

## Operating modes

The receiver runs in one of two modes based on whether `NUXT_WEBHOOK_SECRET` is set:

- **Signed mode (recommended)** — at least one secret is configured. Every call must carry a valid `x-webhook-signature` header, a `x-webhook-id` for dedup, and a fresh timestamp. The rate limiter is a secondary defence on top of cryptographic auth.
- **Open mode (fallback)** — `NUXT_WEBHOOK_SECRET` is empty. The receiver accepts requests without signature, timestamp, or webhook-id headers. Rate limiting (10/min/IP) and body validation still run; everything else (signature parse, replay window, dedup) is skipped. A `[webhook] No secret configured — accepting unauthenticated invalidation request from <ip>` warning is logged on every accepted call.

Open mode exists so an environment that hasn't shipped `NUXT_WEBHOOK_SECRET` yet can still bust caches operationally instead of returning errors on every call. **Set the secret as soon as the env supports it** — open mode is a deliberate availability/security tradeoff, not a long-term posture.

## Important Notes

- **Timestamp window**: Requests older than 5 minutes are rejected. Make sure your server clock is reasonably accurate (NTP).
- **Idempotency**: The `x-webhook-id` header is used for deduplication. If you retry a failed delivery, use a **new** ID. If you're replaying the same logical event, use the **same** ID.
- **Body must be exact**: The signature is computed over the raw JSON body string. Do not re-serialize or pretty-print between signing and sending.
