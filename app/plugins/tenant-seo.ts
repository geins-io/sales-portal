/**
 * SEO plugin: sets meta tags, lang attribute, verification codes,
 * and schema.org structured data (Organization + WebSite) per tenant.
 *
 * Visual theming (CSS, fonts, favicon) is handled server-side by
 * server/plugins/04.tenant-css.ts to prevent FOUC.
 */
import { computed } from 'vue';
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

    // Reactive locale: re-evaluated at render time (after the route middleware
    // has called $i18n.setLocale). A plain `const locale = i18n.locale.value`
    // would freeze to the default 'sv' on SSR because plugins run before the
    // locale-market middleware. Using a computed ensures that useHead getters
    // and the og:locale computed re-read the current locale when unhead
    // serialises the head on the server.
    const seoLocale = computed(
      () => i18n.locale.value || tenant.value?.locale || 'sv',
    );

    // Reactive meta array: rebuilt whenever seoLocale changes so og:locale
    // always reflects the URL locale rather than the plugin-setup-time default.
    const reactiveMeta = computed(() => {
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
        content: seoLocale.value.replace('-', '_'),
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
      const primaryColor = tenant.value?.theme?.colors?.primary;
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

      return meta;
    });

    // Title template from tenant config
    const titleTemplate = seo?.titleTemplate ?? `%s - ${brandName.value}`;

    useHead({
      title: seo?.defaultTitle || undefined,
      titleTemplate,
      htmlAttrs: {
        // Getter so unhead re-evaluates at render time (post-middleware).
        // A plain string would be captured once at plugin setup and would
        // yield the default locale on hard loads of non-default-locale pages.
        lang: () => seoLocale.value,
      },
      meta: reactiveMeta,
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
      // Getter so inLanguage tracks seoLocale reactively at render time.
      // DeepResolvableProperties (the unhead type backing defineWebSite) allows
      // each property to be a ref or a getter function.
      inLanguage: () => seoLocale.value,
    };

    if (seo?.defaultDescription) {
      webSiteSchema.description = seo.defaultDescription;
    }

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
