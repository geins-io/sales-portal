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

    // BCP-47 form of the active locale for `<html lang>`. The short URL-locale
    // code ('en' / 'sv') is mapped to the locale object's `language` field
    // ('en' / 'sv-SE') declared in nuxt.config i18n. Reading the language off
    // i18n.locales avoids hardcoding the region tag and keeps tenant-seo in
    // lockstep with the i18n config. Falls back to the short locale when no
    // matching locale object is found (e.g. tenant.locale fallback values).
    const seoLang = computed(() => {
      const code = seoLocale.value;
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

      if (seo?.defaultKeywords?.length) {
        meta.push({
          name: 'keywords',
          content: seo.defaultKeywords.join(', '),
        });
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
    // and programmatic setLocale reflects the DEFAULT locale ('sv' -> 'sv-SE')
    // rather than the active URL locale. A default-priority entry (weight 100)
    // would lose to it, so we pin a numeric priority above 102 to deterministi-
    // cally win. Kept separate from the title/meta entry above so the numeric
    // priority does not reweight the title tag.
    useHead(
      {
        htmlAttrs: {
          // Getter so unhead re-evaluates at render time (post-middleware).
          // A plain string would be captured once at plugin setup and would
          // yield the default locale on hard loads of non-default-locale pages.
          // Resolves to the active locale's BCP-47 `language` ('en' / 'sv-SE').
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
