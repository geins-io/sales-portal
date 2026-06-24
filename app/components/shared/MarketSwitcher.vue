<script setup lang="ts">
import { MapPin } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    /** Display variant: icon-only button, text+icon button, or inline button row */
    variant?: 'icon' | 'text' | 'inline';
  }>(),
  { variant: 'icon' },
);

const { availableMarkets } = useTenant();
const { t, locale: currentLocale } = useI18n();
const { currentMarket, switchMarket: switchMarketNav } = useLocaleMarket();

async function switchMarket(m: string) {
  await switchMarketNav(m);
}

// Markets arrive as bare 2-letter region codes (e.g. "se"). The trigger keeps
// the short code, while the option list shows the localized country name with
// the code, e.g. "Sweden (SE)". Falls back to the bare uppercase code when the
// runtime can't resolve the region (custom market codes, missing ICU data).
const regionNames = computed(() => {
  try {
    return new Intl.DisplayNames([currentLocale.value], { type: 'region' });
  } catch {
    return null;
  }
});

function marketLabel(code: string): string {
  const upper = code.toUpperCase();
  try {
    const name = regionNames.value?.of(upper);
    if (name && name !== upper) return `${name} (${upper})`;
  } catch {
    // Malformed region code: fall through to the bare code below.
  }
  return upper;
}

const showSwitcher = computed(() => availableMarkets.value.length > 1);
</script>

<template>
  <!-- Inline: flat button row -->
  <div v-if="showSwitcher && props.variant === 'inline'" class="flex gap-1">
    <Button
      v-for="m in availableMarkets as string[]"
      :key="m"
      :variant="m === currentMarket ? 'secondary' : 'ghost'"
      size="sm"
      @click="switchMarket(m)"
    >
      {{ m.toUpperCase() }}
    </Button>
  </div>

  <!-- Dropdown: icon-only or text+icon trigger -->
  <DropdownMenu v-else-if="showSwitcher">
    <DropdownMenuTrigger as-child>
      <Button
        v-if="props.variant === 'text'"
        variant="ghost"
        size="sm"
        class="h-auto py-2"
        :aria-label="t('common.change_market')"
      >
        <MapPin class="mr-2 h-4 w-4" />
        {{ currentMarket.toUpperCase() }}
      </Button>
      <Button
        v-else
        variant="ghost"
        size="icon"
        :aria-label="t('common.change_market')"
      >
        <MapPin class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      class="max-h-[80dvh] w-screen rounded-none p-0 md:w-auto md:rounded-md md:p-1"
    >
      <DropdownMenuLabel>{{ t('common.market') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="m in availableMarkets as string[]"
        :key="m"
        class="border-border border-b py-3 last:border-b-0 md:border-b-0 md:py-1.5"
        :class="{ 'font-semibold': m === currentMarket }"
        @click="switchMarket(m)"
      >
        {{ marketLabel(m) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
