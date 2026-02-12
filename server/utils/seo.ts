import type { TenantConfig } from '#shared/types/tenant-config';

export interface OrganizationSchema {
  name: string;
  url: string;
  logo?: string;
  contactPoint?: { email?: string; telephone?: string };
  sameAs?: string[];
}

export interface WebSiteSchema {
  name: string;
  url: string;
  description?: string;
  inLanguage?: string;
}

/**
 * Builds the canonical site URL from a hostname.
 */
export function buildSiteUrl(hostname: string): string {
  return `https://${hostname}`;
}

/**
 * Extracts non-null social URLs from the contact social config.
 */
export function buildSocialLinks(
  social?: Record<string, string | null | undefined> | null,
): string[] {
  if (!social) return [];
  return Object.values(social).filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
}

/**
 * Determines if the site should be indexable based on the robots string.
 * Returns false if robots contains 'noindex', true otherwise.
 */
export function isIndexable(robots?: string | null): boolean {
  if (!robots) return true;
  return !robots.toLowerCase().includes('noindex');
}

/**
 * Builds an Organization schema.org object from tenant config.
 */
export function buildOrganizationSchema(
  config: TenantConfig,
): OrganizationSchema {
  const org: OrganizationSchema = {
    name: config.branding.name,
    url: buildSiteUrl(config.hostname),
  };

  if (config.branding.logoUrl) {
    org.logo = config.branding.logoUrl;
  }

  if (config.contact?.email || config.contact?.phone) {
    org.contactPoint = {};
    if (config.contact.email) org.contactPoint.email = config.contact.email;
    if (config.contact.phone) org.contactPoint.telephone = config.contact.phone;
  }

  const socialLinks = buildSocialLinks(config.contact?.social);
  if (socialLinks.length > 0) {
    org.sameAs = socialLinks;
  }

  return org;
}

/**
 * Builds a WebSite schema.org object from tenant config.
 */
export function buildWebSiteSchema(config: TenantConfig): WebSiteSchema {
  const site: WebSiteSchema = {
    name: config.branding.name,
    url: buildSiteUrl(config.hostname),
  };

  if (config.seo?.defaultDescription) {
    site.description = config.seo.defaultDescription;
  }

  if (config.geinsSettings?.locale) {
    site.inLanguage = config.geinsSettings.locale;
  }

  return site;
}
