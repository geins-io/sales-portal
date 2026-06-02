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
  if (alt) return alt;
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
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>{{ t('common.language') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <a
        v-for="loc in availableLocales as string[]"
        :key="loc"
        :href="localeHref(loc)"
        class="hover:bg-accent hover:text-accent-foreground relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none"
        :class="{ 'font-semibold': loc === currentLocale }"
      >
        {{ localeNames.get(loc) ?? loc }}
      </a>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
