import type { H3Event } from 'h3';

/** The channel settings the market-selection handlers read off a tenant. */
type TenantChannelSettings = {
  channelId: string;
  defaultMarket: string;
};

/**
 * An event carrying only `context.tenant.config.channelSettings`.
 *
 * An `H3Event` wraps a node request/response pair and cannot be written as a
 * literal, so the one unavoidable widening lives here instead of at each call
 * site — which in exchange gets its context shape checked.
 */
export function eventWithChannelSettings(
  channelSettings: TenantChannelSettings,
): H3Event {
  return {
    context: { tenant: { config: { channelSettings } } },
  } as unknown as H3Event;
}
