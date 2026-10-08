import type {
  CartLineConfiguration,
  CartLineConfigurationRow,
} from '#shared/types/commerce';
import type { ConfigurationSummaryLineType } from '@geins/types';

/** A committed summary as the buyer reads it; a null label or value is empty. */
export function summaryRows(
  list: ConfigurationSummaryLineType[],
): CartLineConfigurationRow[] {
  return list.map((line) => ({
    label: line.label ?? '',
    value: line.value ?? '',
  }));
}

/**
 * A cart line's configuration, from the line as the SDK reads it. A line with
 * an id and no configuration was added before the configuration was copied
 * onto cart items: it is still configured, with no summary to show.
 */
export function cartLineConfiguration(line: {
  configurationId?: string | null;
  configuration?: { summary: ConfigurationSummaryLineType[] } | null;
}): CartLineConfiguration | undefined {
  if (!line.configurationId) return undefined;
  return {
    configurationId: line.configurationId,
    summary: summaryRows(line.configuration?.summary ?? []),
  };
}
