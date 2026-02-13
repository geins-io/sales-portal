/**
 * SEO plugin — sets meta tags, lang attribute, verification codes,
 * and schema.org structured data (Organization + WebSite) per tenant.
 *
 * Runs after tenant-theme (which handles visual theming: CSS, fonts, favicon).
 */
import type { Composer } from 'vue-i18n';

export default defineNuxtPlugin({
  name: 'tenant-seo',
  dependsOn: ['tenant-theme'],
  async setup(nuxtApp) {
    const { tenant, brandName, hostname, ogImageUrl, suspense } = useTenant();
    const i18n = nuxtApp.$i18n as Composer;

    await suspense();

    if (!tenant.value?.isActive) return;

    const seo = tenant.value.seo;
    const contact = tenant.value.contact;
    const locale = i18n.locale.value || tenant.value.locale || 'en';

    // Build meta tags
    const meta: Array<Record<string, string>> = [];

    if (seo?.defaultDescription) {
      meta.push({ name: 'description', content: seo.defaultDescription });
    }

    if (seo?.robots) {
      meta.push({ name: 'robots', content: seo.robots });
    }

    // Open Graph basics
    meta.push({ property: 'og:site_name', content: brandName.value });
    meta.push({ property: 'og:type', content: 'website' });
    meta.push({
      property: 'og:locale',
      content: locale.replace('-', '_'),
    });

    if (ogImageUrl.value) {
      meta.push({ property: 'og:image', content: ogImageUrl.value });
    }

    // Twitter Card
    meta.push({ name: 'twitter:card', content: 'summary_large_image' });
    if (ogImageUrl.value) {
      meta.push({ name: 'twitter:image', content: ogImageUrl.value });
    }

    // Browser theme color (address bar, task switcher)
    const primaryColor = tenant.value.theme?.colors?.primary;
    if (primaryColor) {
      meta.push({ name: 'theme-color', content: primaryColor as string });
    }

    // Search engine verification
    if (seo?.verification?.google) {
      meta.push({
        name: 'google-site-verification',
        content: seo.verification.google,
      });
    }
    if (seo?.verification?.bing) {
      meta.push({ name: 'msvalidate.01', content: seo.verification.bing });
    }

    // Title template from tenant config
    const titleTemplate = seo?.titleTemplate ?? `%s - ${brandName.value}`;

    useHead({
      title: seo?.defaultTitle || undefined,
      titleTemplate,
      htmlAttrs: {
        lang: locale,
      },
      meta,
    });

    // Schema.org structured data
    const siteUrl = `https://${hostname.value}`;

    const orgSchema: Record<string, unknown> = {
      name: brandName.value,
      url: siteUrl,
    };

    if (tenant.value.branding?.logoUrl) {
      orgSchema.logo = tenant.value.branding.logoUrl;
    }

    if (contact?.email || contact?.phone) {
      orgSchema.contactPoint = {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        ...(contact.email && { email: contact.email }),
        ...(contact.phone && { telephone: contact.phone }),
      };
    }

    // Social links
    const socialLinks = buildSocialLinksFromContact(contact?.social);
    if (socialLinks.length > 0) {
      orgSchema.sameAs = socialLinks;
    }

    const webSiteSchema: Record<string, unknown> = {
      name: brandName.value,
      url: siteUrl,
    };

    if (seo?.defaultDescription) {
      webSiteSchema.description = seo.defaultDescription;
    }

    webSiteSchema.inLanguage = locale;

    useSchemaOrg([defineOrganization(orgSchema), defineWebSite(webSiteSchema)]);
  },
});

/**
 * Extract non-null social URLs from contact social config.
 */
function buildSocialLinksFromContact(
  social?: Record<string, string | null | undefined> | null,
): string[] {
  if (!social) return [];
  return Object.values(social).filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
}
