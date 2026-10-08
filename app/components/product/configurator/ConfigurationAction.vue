<script setup lang="ts">
import { AlertCircle, LogIn, Loader2, ShoppingCart } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { useAuthStore } from '~/stores/auth';

/**
 * What the buyer does with the configuration: sign in to see what it costs, or
 * put it in the cart, which commits it and adds the committed line. While a
 * configured cart line is being edited the same press updates that line, and
 * the buyer can also go back to the line's own choices or leave it as it was.
 */
const {
  canCommit,
  busy,
  incomplete,
  error = null,
  editing = false,
} = defineProps<{
  canCommit: boolean;
  busy: boolean;
  /** The provider says required choices are still missing. */
  incomplete: boolean;
  /** Why the action cannot be taken, when it is not the missing choices. */
  error?: string | null;
  /** A configured cart line is being edited: the action updates it. */
  editing?: boolean;
}>();

const emit = defineEmits<{ submit: []; revert: []; cancel: [] }>();

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
         and the page lists which. Not `disabled`: that lets a press fall
         through, and the press that blurs a typed field lands while the
         field's batch runs. The page decides what a press does. -->
    <Button
      v-else
      class="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      size="lg"
      variant="purchase"
      :aria-disabled="!canCommit"
      :aria-busy="busy"
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
        t(
          incomplete
            ? 'configurator.commit_incomplete'
            : editing
              ? 'configurator.edit.update'
              : 'product.add_to_cart',
        )
      }}
    </Button>

    <div v-if="editing" class="mt-2 flex gap-2">
      <Button
        variant="outline"
        class="flex-1"
        :disabled="busy"
        data-testid="configurator-edit-revert"
        @click="emit('revert')"
      >
        {{ t('configurator.edit.revert') }}
      </Button>
      <Button
        variant="ghost"
        class="flex-1"
        :disabled="busy"
        data-testid="configurator-edit-cancel"
        @click="emit('cancel')"
      >
        {{ t('configurator.edit.cancel') }}
      </Button>
    </div>

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
