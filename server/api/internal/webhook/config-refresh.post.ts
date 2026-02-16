import { processConfigRefresh } from '../../../utils/webhook-handler';
import { parseSecrets } from '../../../utils/webhook';
import { getClientIp } from '../../../utils/rate-limiter';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const result = await processConfigRefresh(
    {
      clientIp: getClientIp(event),
      secrets: parseSecrets(config.webhookSecret as string),
      rawBody: await readRawBody(event),
      signatureHeader: getHeader(event, 'x-webhook-signature'),
      webhookId: getHeader(event, 'x-webhook-id'),
      contentLength: Number(getHeader(event, 'content-length')) || 0,
    },
    useStorage('kv'),
    useStorage('cache'),
  );

  setResponseStatus(event, 200);
  return result;
});
