/**
 * SEO plugin: sets meta tags, lang attribute, the Google Search Console
 * verification token, and schema.org structured data (Organization + WebSite)
 * per tenant.
 *
 * Visual theming (CSS, fonts, favicon) is handled server-side by
 * server/plugins/04.tenant-css.ts to prevent FOUC.
 */
import type { Composer } from 'vue-i18n';

export default defineNuxtPlugin({
  name: 'tenant-seo',
  async setup(nuxtApp) {
    const { tenant, brandName, hostname, ogImageUrl, suspense } = useTenant();
    const i18n = nuxtApp.$i18n as Composer;

    await suspense();

    if (!tenant.value?.isActive) return;

    const seo = tenant.value.seo;
    const contact = tenant.value.contact;
    const locale = i18n.locale.value || tenant.value.locale || 'sv';

    // Build meta tags
    const meta: Array<Record<string, string>> = [];

    if (seo?.defaultDescription) {
      meta.push({ name: 'description', content: seo.defaultDescription });
    }

    if (seo?.robots) {
      meta.push({ name: 'robots', content: seo.robots });
    }

    if (seo?.defaultKeywords?.length) {
      meta.push({ name: 'keywords', content: seo.defaultKeywords.join(', ') });
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

    // Google Search Console verification
    const verification = seo?.verification?.trim();
    if (verification) {
      meta.push({ name: 'google-site-verification', content: verification });
    }

    // Title resolution:
    //   - The literal `title` pins the tenant defaultTitle so @nuxtjs/seo's
    //     automatic route-segment title inference (which would render e.g.
    //     "Sv" from the locale path) never leaks onto pages that set no title
    //     of their own, like the home page.
    //   - The function template wraps a page's own title as "PageTitle | Brand"
    //     but returns the defaultTitle verbatim when the active title IS the
    //     default (home page) or is empty, so it never double-wraps into
    //     "Brand | Brand". An empty Studio template falls back to the brand
    //     pattern so a wrapped title never renders bare.
    const titleTemplate = seo?.titleTemplate || `%s - ${brandName.value}`;
    const defaultTitle = seo?.defaultTitle || brandName.value;

    useHead({
      title: defaultTitle,
      titleTemplate: (pageTitle?: string | null) =>
        !pageTitle || pageTitle === defaultTitle
          ? defaultTitle
          : titleTemplate.replace('%s', pageTitle),
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
