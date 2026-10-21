import type { TenantConfig } from '#shared/types/tenant-config';

/**
 * The tenant's default page title: `seo.defaultTitle`, or the brand name when
 * it is empty or absent. Shared by `<title>` and the start page's h1 so the two
 * cannot drift apart.
 */
export function resolveDefaultTitle(
  seo:
    | Pick<NonNullable<TenantConfig['seo']>, 'defaultTitle'>
    | null
    | undefined,
  brandName: string,
): string {
  return seo?.defaultTitle || brandName;
}
