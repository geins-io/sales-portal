/**
 * Locale-aware country options helper. Pure function, SSR-safe (no DOM access).
 *
 * Labels are resolved at call time via Intl.DisplayNames using the provided locale.
 * Codes that cannot be resolved by Intl.DisplayNames are silently skipped.
 * The result is sorted by localized label using localeCompare.
 */

import { ISO_3166_1_ALPHA2 } from '#shared/constants/iso-regions';

import type { SupportedLocale } from '#shared/utils/locale-market';

export interface CountryOption {
  value: string;
  label: string;
}

/**
 * Returns a locale-aware list of country options sorted by localized label.
 *
 * @param locale - A supported locale code (e.g. 'sv', 'en')
 * @returns Array of { value: ISO code, label: localized country name }
 */
export function getCountryOptions(locale: SupportedLocale): CountryOption[] {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' });

  const options: CountryOption[] = [];

  for (const code of ISO_3166_1_ALPHA2) {
    const label = displayNames.of(code);
    if (label !== undefined && label !== code) {
      options.push({ value: code, label });
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, locale));
}
