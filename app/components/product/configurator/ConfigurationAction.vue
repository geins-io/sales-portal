<script setup lang="ts">
import { LogIn, Loader2 } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

/**
 * What the buyer does with the configuration: sign in to see what it costs, or
 * finish it.
 *
 * Its own component because the next milestone replaces it wholesale — an
 * add-to-cart and a request-quote path, and update / revert / cancel when a
 * configured cart line is being edited — while everything else in the card
 * stays as it is.
 */
const { canCommit, busy } = defineProps<{
  canCommit: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{ commit: [] }>();

const { t } = useI18n();
const { showPrice, canUnlockByAuth } = usePriceVisibility();
const auth = useAuthStore();
</script>

<template>
  <div class="px-4 py-3">
    <Button
      v-if="!showPrice && canUnlockByAuth"
      class="w-full"
      size="lg"
      variant="outline"
      data-testid="configurator-signin"
      @click="auth.openSheet('login')"
    >
      <LogIn class="size-4" />
      {{ t('product.login_for_prices') }}
    </Button>

    <!-- Never dead without a reason: what is missing is listed in the panel
         above. -->
    <Button
      v-else
      class="w-full"
      size="lg"
      variant="purchase"
      :disabled="!canCommit"
      data-testid="configurator-commit"
      @click="emit('commit')"
    >
      <Loader2 v-if="busy" class="size-4 animate-spin" />
      {{ t('configurator.commit') }}
    </Button>
  </div>
</template>
