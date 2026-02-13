<script setup lang="ts">
import { MapPin } from 'lucide-vue-next';
import { COOKIE_NAMES } from '#shared/constants/storage';

const props = withDefaults(
  defineProps<{
    /** Display variant: icon-only button, text+icon button, or inline button row */
    variant?: 'icon' | 'text' | 'inline';
  }>(),
  { variant: 'icon' },
);

const { availableMarkets, market } = useTenant();
const { t } = useI18n();

const marketCookie = useCookie(COOKIE_NAMES.MARKET, {
  maxAge: 365 * 24 * 60 * 60,
});

const currentMarket = computed(() => marketCookie.value || market.value);

function switchMarket(m: string) {
  marketCookie.value = m;
  reloadNuxtApp();
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
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>{{ t('common.market') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="m in availableMarkets as string[]"
        :key="m"
        :class="{ 'font-semibold': m === currentMarket }"
        @click="switchMarket(m)"
      >
        {{ m.toUpperCase() }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
