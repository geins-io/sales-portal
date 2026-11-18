<script setup lang="ts">
import { FileText, Loader2 } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useCartStore } from '~/stores/cart';
import { internalFetch } from '~/utils/internal-fetch';

const { t } = useI18n();
const cartStore = useCartStore();
const router = useRouter();
const { canRequestQuotes } = useFeatureAccess();
const { formatLocale } = useFormatLocale();
const { localePath } = useLocaleMarket();

const show = computed(() => canRequestQuotes());
const confirming = ref(false);
const working = ref(false);

/** The request's name before any "(2)": the cart and the day it was asked. */
function baseName(): string {
  const date = new Intl.DateTimeFormat(formatLocale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  return t('cart.quote_request_name', { date });
}

let base = '';
/** Names holding `base` that the buyer's quotations have; none when unread. */
let takenNames: Promise<Set<string>> = Promise.resolve(new Set());

function askFirst() {
  base = baseName();
  takenNames = internalFetch<{ names: string[] }>('/api/quotes/names', {
    query: { search: base },
  }).then(
    ({ names }) => new Set(names),
    () => new Set(),
  );
  confirming.value = true;
}

/** A second cart the same day: "Varukorg 11 nov. 2026 (2)", then "(3)". */
async function draftName(): Promise<string> {
  const taken = await takenNames;
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
  return name;
}

async function addCartToQuote() {
  working.value = true;
  const id = await cartStore.requestQuote(await draftName());
  working.value = false;
  confirming.value = false;
  if (id) {
    await router.push(
      localePath(`/portal/quotations/${encodeURIComponent(id)}/request`),
    );
  }
}
</script>

<template>
  <template v-if="show">
    <Button
      variant="outline"
      class="-mt-1 w-full gap-2 shadow-none"
      data-testid="cart-add-to-quote"
      :disabled="working || cartStore.isLoading || cartStore.isUpdatingLines"
      @click="askFirst"
    >
      <Loader2 v-if="working" class="size-4 animate-spin" />
      <FileText v-else class="size-4" />
      {{ t('cart.add_to_quote') }}
    </Button>
    <p
      v-if="cartStore.quoteRequestError"
      role="alert"
      class="text-danger -mt-2 text-sm"
      data-testid="cart-add-to-quote-error"
    >
      {{ t(cartStore.quoteRequestError) }}
    </p>
    <!-- Held open while the draft is made: closing would not stop it. -->
    <Dialog
      :open="confirming"
      @update:open="(open) => !working && (confirming = open)"
    >
      <DialogContent data-testid="cart-to-quote-dialog" class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('cart.quote_confirm_title') }}</DialogTitle>
          <DialogDescription as="div" class="space-y-3">
            <p>{{ t('cart.quote_confirm_text') }}</p>
            <p>{{ t('cart.quote_confirm_draft') }}</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            data-testid="cart-to-quote-cancel"
            :disabled="working"
            @click="confirming = false"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            data-testid="cart-to-quote-confirm"
            :disabled="working"
            @click="addCartToQuote"
          >
            {{ t('cart.quote_confirm_submit') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </template>
</template>
