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
const { currentMarket } = useLocaleMarket();

/**
 * Generate the URL for switching to a given locale.
 * Always goes to home page — dynamic route slugs are locale-specific.
 * Uses a plain <a href> for full page reload, no JavaScript switching.
 */
function localeHref(loc: string): string {
  return `/${currentMarket.value}/${loc}/`;
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

const currentLocaleName = computed(
  () => localeNames.value.get(currentLocale.value) ?? currentLocale.value,
);

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
        {{ currentLocaleName }}
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
