<script setup lang="ts">
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from 'lucide-vue-next';
import { formatPrice } from '#shared/types/commerce';
import type { Configuration } from '#shared/types/configurator';
import type {
  ConfiguratorSessionError,
  ConfiguratorSessionStatus,
} from '~/composables/useConfiguratorSession';
import { Button } from '~/components/ui/button';
import {
  collectBlockingMessages,
  formatRemaining,
} from '~/utils/configurator-header';

/**
 * What the configuration costs, whether it is complete, whether it is being
 * re-evaluated, and how long the session has left.
 *
 * Flat props rather than the session composable's return object: the header
 * must mount without a session for its tests, and a spread object hides which
 * fields it reads. `expiresAt` is deliberately absent — the composable already
 * derives `remainingMs` from it, and a second clock here would drift from it.
 */
const {
  configuration,
  status,
  busy,
  remainingMs,
  error = null,
} = defineProps<{
  configuration: Configuration | null;
  status: ConfiguratorSessionStatus;
  busy: boolean;
  remainingMs: number;
  error?: ConfiguratorSessionError | null;
}>();

const emit = defineEmits<{ renew: []; restart: [] }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { showPrice, canUnlockByAuth } = usePriceVisibility();

const price = computed(() => {
  if (!configuration) return '';
  const { net, currency } = configuration.unitPrice;
  return formatPrice(net, currency, formatLocale.value);
});

const blocking = computed(() =>
  configuration ? collectBlockingMessages(configuration) : [],
);
</script>

<template>
  <!--
    An expired session is a state, not a failure: it says so and offers the way
    back, with no price and no validity left to report.
  -->
  <div
    v-if="status === 'expired'"
    class="bg-muted flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3"
    data-testid="configurator-header-expired"
  >
    <p class="text-sm">{{ t('configurator.header.expired') }}</p>
    <Button variant="outline" size="sm" @click="emit('restart')">
      <RotateCcw class="size-4" />
      {{ t('configurator.header.start_over') }}
    </Button>
  </div>

  <div v-else-if="configuration" class="space-y-3">
    <div data-testid="configurator-header-price">
      <p v-if="showPrice" class="text-2xl font-semibold">{{ price }}</p>
      <p v-else-if="canUnlockByAuth" class="text-muted-foreground text-sm">
        {{ t('product.login_for_prices') }}
      </p>
    </div>

    <div
      class="flex items-start gap-2 text-sm"
      :class="configuration.isValid ? 'text-foreground' : 'text-destructive'"
      data-testid="configurator-header-validity"
    >
      <CheckCircle2
        v-if="configuration.isValid"
        class="mt-0.5 size-4 shrink-0"
      />
      <AlertCircle v-else class="mt-0.5 size-4 shrink-0" />
      <p v-if="configuration.isValid">{{ t('configurator.header.valid') }}</p>
      <div v-else class="space-y-1">
        <p>{{ t('configurator.header.invalid') }}</p>
        <!-- Each message is a whole sentence, so they are listed, never joined. -->
        <ul v-if="blocking.length" class="list-inside list-disc">
          <li v-for="text in blocking" :key="text">{{ text }}</li>
        </ul>
      </div>
    </div>

    <p
      v-if="busy"
      class="text-muted-foreground flex items-center gap-2 text-sm"
      data-testid="configurator-header-busy"
    >
      <Loader2 class="size-4 animate-spin" />
      {{ t('configurator.header.recomputing') }}
    </p>

    <div
      class="flex flex-wrap items-center gap-3 text-sm"
      data-testid="configurator-header-expiry"
    >
      <span class="text-muted-foreground tabular-nums">
        {{
          t('configurator.header.time_left', {
            time: formatRemaining(remainingMs),
          })
        }}
      </span>
      <Button
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="emit('renew')"
      >
        {{ t('configurator.header.renew') }}
      </Button>
      <!--
        A 410 has already become the expired state above, so anything left here
        is a renew that failed for another reason and belongs at the button.
      -->
      <span v-if="error" class="text-destructive">
        {{ t('configurator.header.renew_failed') }}
      </span>
    </div>
  </div>
</template>
