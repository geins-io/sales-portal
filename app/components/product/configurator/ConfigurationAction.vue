<script setup lang="ts">
import { AlertCircle, LogIn, Loader2, ShoppingCart } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

/**
 * What the buyer does with the configuration: sign in to see what it costs, or
 * put it in the cart, which commits it and adds the committed line.
 *
 * Its own component because what follows replaces parts of it — a
 * request-quote path, and update / revert / cancel when a configured cart line
 * is being edited — while everything else in the card stays as it is.
 */
const {
  canCommit,
  busy,
  incomplete,
  error = null,
} = defineProps<{
  canCommit: boolean;
  busy: boolean;
  /** The provider says required choices are still missing. */
  incomplete: boolean;
  /** Why the action cannot be taken, when it is not the missing choices. */
  error?: string | null;
}>();

const emit = defineEmits<{ submit: [] }>();

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

    <!-- Never dead without a reason: the label says required choices remain,
         and the page lists which. -->
    <Button
      v-else
      class="w-full"
      size="lg"
      variant="purchase"
      :disabled="!canCommit"
      data-testid="configurator-commit"
      @click="emit('submit')"
    >
      <Loader2 v-if="busy" class="size-4 animate-spin" />
      <ShoppingCart
        v-else
        class="size-4"
        data-testid="configurator-cart-icon"
      />
      {{
        t(incomplete ? 'configurator.commit_incomplete' : 'product.add_to_cart')
      }}
    </Button>

    <p
      v-if="error"
      class="text-destructive mt-2 flex items-start gap-2 text-sm"
      data-testid="configurator-action-error"
    >
      <AlertCircle class="mt-0.5 size-4 shrink-0" />
      {{ error }}
    </p>
  </div>
</template>
