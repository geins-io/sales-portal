interface Typography {
  fontFamily: string;
  headingFontFamily?: string | null;
  monoFontFamily?: string | null;
}

/**
 * Builds a Google Fonts CSS2 API URL from typography config.
 * Returns null if no font families are configured.
 */
export function buildGoogleFontsUrl(
  typography?: Typography | null,
): string | null {
  if (!typography) return null;

  const families = new Set<string>();
  if (typography.fontFamily) families.add(typography.fontFamily);
  if (typography.headingFontFamily) families.add(typography.headingFontFamily);
  if (typography.monoFontFamily) families.add(typography.monoFontFamily);

  if (families.size === 0) return null;

  const url = new URL('https://fonts.googleapis.com/css2');
  families.forEach((f) =>
    url.searchParams.append('family', `${f}:wght@300;400;500;600;700`),
  );
  url.searchParams.append('display', 'swap');
  return url.toString();
}
