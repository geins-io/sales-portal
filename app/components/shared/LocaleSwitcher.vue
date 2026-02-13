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
const { locale: currentLocale, setLocale, locales, t } = useI18n();

function switchLocale(loc: string) {
  setLocale(loc as 'en' | 'sv');
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
    <Button
      v-for="loc in availableLocales as string[]"
      :key="loc"
      :variant="loc === currentLocale ? 'secondary' : 'ghost'"
      size="sm"
      @click="switchLocale(loc)"
    >
      {{ localeNames.get(loc) ?? loc }}
    </Button>
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
      <DropdownMenuItem
        v-for="loc in availableLocales as string[]"
        :key="loc"
        :class="{ 'font-semibold': loc === currentLocale }"
        @click="switchLocale(loc)"
      >
        {{ localeNames.get(loc) ?? loc }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
