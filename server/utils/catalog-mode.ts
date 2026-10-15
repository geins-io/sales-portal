import type { H3Event } from 'h3';

/** Refuses a cart write, checkout step or configuration on a catalogue-mode tenant. */
export function assertCommerceMode(event: H3Event): void {
  if (event.context.tenant?.config?.mode === 'catalog') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not available in catalogue mode',
    });
  }
}
