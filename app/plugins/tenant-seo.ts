/**
 * SEO plugin: sets meta tags, lang attribute, the Google Search Console
 * verification token, and schema.org structured data (Organization + WebSite)
 * per tenant.
 *
 * Visual theming (CSS, fonts, favicon) is handled server-side by
 * server/plugins/04.tenant-css.ts to prevent FOUC.
 */
import { computed } from 'vue';
import type { Composer } from 'vue-i18n';
import { findTenantBcp47 } from '~/utils/locale-bcp47';

export default defineNuxtPlugin({
  name: 'tenant-seo',
  async setup(nuxtApp) {
    const { tenant, brandName, hostname, ogImageUrl, suspense } = useTenant();
    const i18n = nuxtApp.$i18n as Composer;

    await suspense();

    if (!tenant.value?.isActive) return;

    const seo = tenant.value.seo;
    const contact = tenant.value.contact;

    // Computed, not a plain read: plugins run before the locale-market
    // middleware, so a snapshot would freeze to the default locale on SSR.
    const seoLocale = computed(
      () => i18n.locale.value || tenant.value?.locale || 'sv',
    );

    // `<html lang>`: tenant tag ('en' -> 'en-GB'), then the i18n locale's
    // `language`, then the bare code. The tenant wins because the region is
    // tenant-dependent — nuxt.config leaves 'en' region-less for that reason.
    // This is the document language, not hreflang targeting; they differ.
    const seoLang = computed(() => {
      const code = seoLocale.value;
      const tenantTag = findTenantBcp47(code, tenant.value?.availableLocales);
      if (tenantTag) return tenantTag;

      const localeObjects = i18n.locales?.value ?? [];
      const match = localeObjects.find(
        (l) => typeof l === 'object' && l !== null && l.code === code,
      );
      const language =
        typeof match === 'object' && match !== null
          ? match.language
          : undefined;
      return language || code;
    });

    const reactiveMeta = computed(() => {
      const meta: Array<Record<string, string>> = [];

      if (seo?.defaultDescription) {
        meta.push({ name: 'description', content: seo.defaultDescription });
      }

      if (seo?.robots) {
        meta.push({ name: 'robots', content: seo.robots });
      }

      if (seo?.defaultKeywords?.length) {
        meta.push({
          name: 'keywords',
          content: seo.defaultKeywords.join(', '),
        });
      }

      // Open Graph basics
      meta.push({ property: 'og:site_name', content: brandName.value });
      meta.push({ property: 'og:type', content: 'website' });
      // Open Graph wants the underscore form of <html lang>: 'nb-NO' -> 'nb_NO'.
      meta.push({
        property: 'og:locale',
        content: seoLang.value.replace('-', '_'),
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

      // Google Search Console verification (flat token from store settings)
      const verification = seo?.verification?.trim();
      if (verification) {
        meta.push({ name: 'google-site-verification', content: verification });
      }

      return meta;
    });

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
      meta: reactiveMeta,
    });

    // `<html lang>` is registered in its own head entry with an explicit high
    // numeric tagPriority. unhead merges every htmlAttrs entry into a single
    // <html> tag and, for a scalar prop like `lang`, the entry that sorts LAST
    // (highest weight) overwrites the value. nuxt-seo-utils registers its own
    // htmlAttrs.lang with tagPriority 'low' (weight 102) sourced from the site
    // config's current/default locale, which on SSR with strategy 'no_prefix'
    // and programmatic setLocale reflects the DEFAULT locale rather than the
    // active URL locale. A default-priority entry (weight 100)
    // would lose to it, so we pin a numeric priority above 102 to deterministi-
    // cally win. Kept separate from the title/meta entry above so the numeric
    // priority does not reweight the title tag.
    useHead(
      {
        htmlAttrs: {
          // Getter so unhead re-evaluates after the middleware has run.
          lang: () => seoLang.value,
        },
      },
      { tagPriority: 1000 },
    );

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
