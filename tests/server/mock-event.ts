import type { H3Event } from 'h3';

/** The Geins settings the market-selection handlers read off a tenant. */
type TenantGeinsSettings = {
  channel: string;
  tld: string;
  market: string;
};

/**
 * An event carrying only `context.tenant.config.geinsSettings`.
 *
 * An `H3Event` wraps a node request/response pair and cannot be written as a
 * literal, so the one unavoidable widening lives here instead of at each call
 * site — which in exchange gets its context shape checked.
 */
export function eventWithGeinsSettings(
  geinsSettings: TenantGeinsSettings,
): H3Event {
  return {
    context: { tenant: { config: { geinsSettings } } },
  } as unknown as H3Event;
}
