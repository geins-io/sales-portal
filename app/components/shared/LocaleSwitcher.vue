<script setup lang="ts">
import { Globe } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    /** Display variant: icon-only button, text+icon button, or inline button row */
    variant?: 'icon' | 'text' | 'inline';
  }>(),
  { variant: 'icon' },
);

const { availableLocales } = useTenant();
const { locale: currentLocale, locales, t } = useI18n();
const { currentMarket, getCleanPath } = useLocaleMarket();
const { hrefFor } = useLocaleAlternates();
const route = useRoute();

/**
 * Generate the URL for switching to a given locale.
 *
 * Alternates-first: when the current entity (PDP/PLP) has published a
 * per-locale alternate for the target locale, use it so the switch lands
 * on the real target-language slug (e.g. SV `skarkant` -> EN
 * `cutting-edge`) rather than carrying the current locale's slug forward.
 * Clean-path fallback: when no alternate is published (homepage, cart,
 * CMS, account, or any locale Geins has no entry for), preserve the
 * current path under the new `/market/locale/` prefix; the server
 * renders default-language content for missing translations.
 *
 * Plain `<a href>` keeps full page reload behavior, dropping the SPA
 * cache so menus, lists, and CMS slots all re-resolve in the new locale.
 */
function localeHref(loc: string): string {
  const alt = hrefFor(loc);
  // Sort, filters, and pagination live in the query string, not the slug: they
  // tune the SAME entity page, so carry them across the switch to keep the
  // user's view. A filter with no match in the new locale degrades to
  // unfiltered, never a 404. The clean-path fallback already keeps the query
  // via getCleanPath, so both branches preserve it.
  if (alt) {
    const q = route.fullPath.indexOf('?');
    return q >= 0 ? alt + route.fullPath.slice(q) : alt;
  }
  return `/${currentMarket.value}/${loc}${getCleanPath()}`;
}

/** Map locale code → display name from i18n config */
const localeNames = computed(() => {
  const map = new Map<string, string>();
  for (const loc of locales.value) {
    if (typeof loc === 'string') {
      map.set(loc, loc);
    } else {
      map.set(loc.code, loc.name ?? loc.code);
    }
  }
  return map;
});

// Short uppercase abbreviation shown in the trigger (e.g. "SV"/"EN")
// instead of the full language name. Applied on every breakpoint so the
// topbar stays compact; the dropdown list keeps the full names.
const currentLocaleAbbr = computed(() => currentLocale.value.toUpperCase());

const showSwitcher = computed(() => availableLocales.value.length > 1);
</script>

<template>
  <!-- Inline: flat button row -->
  <div v-if="showSwitcher && props.variant === 'inline'" class="flex gap-1">
    <a
      v-for="loc in availableLocales as string[]"
      :key="loc"
      :href="localeHref(loc)"
      data-testid="locale-switcher-link"
      :data-locale="loc"
      class="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
      :class="
        loc === currentLocale
          ? 'bg-secondary text-secondary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'
      "
    >
      {{ localeNames.get(loc) ?? loc }}
    </a>
  </div>

  <!-- Dropdown: icon-only or text+icon trigger -->
  <DropdownMenu v-else-if="showSwitcher">
    <DropdownMenuTrigger as-child>
      <Button
        v-if="props.variant === 'text'"
        variant="ghost"
        size="sm"
        class="h-auto py-2"
        :aria-label="t('common.change_language')"
      >
        <Globe class="mr-2 h-4 w-4" />
        {{ currentLocaleAbbr }}
      </Button>
      <Button
        v-else
        variant="ghost"
        size="icon"
        :aria-label="t('common.change_language')"
      >
        <Globe class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      class="max-h-[80dvh] w-screen rounded-none p-0 md:w-auto md:rounded-md md:p-1"
    >
      <DropdownMenuLabel>{{ t('common.language') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <a
        v-for="loc in availableLocales as string[]"
        :key="loc"
        :href="localeHref(loc)"
        data-testid="locale-switcher-link"
        :data-locale="loc"
        class="hover:bg-accent hover:text-accent-foreground border-border relative flex cursor-pointer items-center rounded-sm border-b px-2 py-3 text-sm transition-colors outline-none select-none last:border-b-0 md:border-b-0 md:py-1.5"
        :class="{ 'font-semibold': loc === currentLocale }"
      >
        {{ localeNames.get(loc) ?? loc }}
      </a>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
