<script setup lang="ts">
import { Button } from '~/components/ui/button';
import { useQuotesStore } from '~/stores/quotes';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const route = useRoute();
const store = useQuotesStore();

const quoteId = computed(() => route.params.id as string);

useHead({
  title: computed(() => t('portal.quotations.detail_title')),
});

onMounted(async () => {
  await store.fetchQuote(quoteId.value);
  // If quote was not found (fetch failed or returned null), show 404
  if (!store.currentQuote) {
    showError(
      createError({
        statusCode: 404,
        statusMessage: 'Quotation not found',
      }),
    );
  }
});

const quote = computed(() => store.currentQuote);
const isPending = computed(() => quote.value?.status === 'pending');

// Decline form state
const showDeclineForm = ref(false);
const declineReason = ref('');

function openDeclineForm() {
  showDeclineForm.value = true;
  declineReason.value = '';
}

function cancelDecline() {
  showDeclineForm.value = false;
  declineReason.value = '';
}

async function handleAccept() {
  if (!quote.value) return;
  await store.acceptQuote(quote.value.id);
}

async function handleDecline() {
  if (!quote.value) return;
  await store.rejectQuote(quote.value.id, declineReason.value);
  showDeclineForm.value = false;
  declineReason.value = '';
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'expired':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function statusLabel(status: string): string {
  return t(`portal.quotations.status_${status}`);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
</script>

<template>
  <PortalShell>
    <!-- Loading -->
    <div
      v-if="store.isLoading"
      data-testid="quote-loading"
      class="flex items-center justify-center py-16"
    >
      <Icon
        name="lucide:loader-circle"
        class="text-muted-foreground size-8 animate-spin"
      />
    </div>

    <!-- Detail View -->
    <div v-else-if="quote" data-testid="quote-detail" class="space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-semibold">
            {{ t('portal.quotations.detail_title') }} #{{ quote.quoteNumber }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ formatDate(quote.createdAt) }}
          </p>
        </div>
        <span
          data-testid="status-badge"
          class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          :class="statusBadgeClass(quote.status)"
        >
          {{ statusLabel(quote.status) }}
        </span>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Left: Line Items -->
        <div class="lg:col-span-2">
          <div class="border-border rounded-lg border">
            <table data-testid="line-items-table" class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">
                    {{ t('portal.quotations.product') }}
                  </th>
                  <th class="px-4 py-3 text-left font-medium">
                    {{ t('portal.quotations.article_number') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('portal.quotations.quantity') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('portal.quotations.unit_price') }}
                  </th>
                  <th class="px-4 py-3 text-right font-medium">
                    {{ t('portal.quotations.line_total') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-border divide-y">
                <tr
                  v-for="item in quote.lineItems"
                  :key="item.sku"
                  data-testid="line-item-row"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <img
                        v-if="item.imageUrl"
                        :src="item.imageUrl"
                        :alt="item.name"
                        class="size-10 rounded object-cover"
                      />
                      <span class="font-medium">{{ item.name }}</span>
                    </div>
                  </td>
                  <td class="text-muted-foreground px-4 py-3">
                    {{ item.articleNumber }}
                  </td>
                  <td class="px-4 py-3 text-right">{{ item.quantity }}</td>
                  <td class="px-4 py-3 text-right">
                    {{ item.unitPriceFormatted }}
                  </td>
                  <td class="px-4 py-3 text-right font-medium">
                    {{ item.totalPriceFormatted }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Summary Sidebar -->
        <div class="space-y-4">
          <!-- Totals -->
          <div
            data-testid="quote-summary"
            class="border-border space-y-2 rounded-lg border p-4"
          >
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">{{
                t('portal.quotations.subtotal')
              }}</span>
              <span>{{ quote.subtotalFormatted }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">{{
                t('portal.quotations.tax')
              }}</span>
              <span>{{ quote.taxFormatted }}</span>
            </div>
            <div
              class="border-border mt-2 flex justify-between border-t pt-2 font-semibold"
            >
              <span>{{ t('portal.quotations.grand_total') }}</span>
              <span>{{ quote.totalFormatted }}</span>
            </div>
          </div>

          <!-- Accept / Decline buttons (pending only) -->
          <template v-if="isPending">
            <div v-if="!showDeclineForm" class="flex flex-col gap-2">
              <Button
                data-testid="accept-btn"
                :disabled="store.isActionLoading"
                @click="handleAccept"
              >
                {{
                  store.isActionLoading
                    ? t('portal.quotations.accepting')
                    : t('portal.quotations.accept')
                }}
              </Button>
              <Button
                data-testid="decline-btn"
                variant="outline"
                :disabled="store.isActionLoading"
                @click="openDeclineForm"
              >
                {{ t('portal.quotations.decline') }}
              </Button>
            </div>

            <!-- Decline form -->
            <div
              v-else
              data-testid="decline-form"
              class="border-border space-y-3 rounded-lg border p-4"
            >
              <label class="text-sm font-medium">
                {{ t('portal.quotations.decline_reason') }}
              </label>
              <textarea
                v-model="declineReason"
                data-testid="decline-reason-input"
                :placeholder="t('portal.quotations.decline_reason_placeholder')"
                rows="3"
                class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div class="flex gap-2">
                <Button
                  data-testid="confirm-decline-btn"
                  variant="destructive"
                  :disabled="store.isActionLoading"
                  @click="handleDecline"
                >
                  {{
                    store.isActionLoading
                      ? t('portal.quotations.declining')
                      : t('portal.quotations.decline')
                  }}
                </Button>
                <Button
                  data-testid="cancel-decline-btn"
                  variant="outline"
                  :disabled="store.isActionLoading"
                  @click="cancelDecline"
                >
                  {{ t('common.cancel') }}
                </Button>
              </div>
            </div>
          </template>

          <!-- Expiration date -->
          <div
            v-if="quote.expiresAt"
            data-testid="expires-at"
            class="border-border space-y-1 rounded-lg border p-4"
          >
            <p
              class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            >
              {{ t('portal.quotations.expires_at') }}
            </p>
            <p class="text-sm font-medium">{{ formatDate(quote.expiresAt) }}</p>
          </div>

          <!-- Payment terms -->
          <div
            v-if="quote.paymentTerms"
            data-testid="payment-terms"
            class="border-border space-y-1 rounded-lg border p-4"
          >
            <p
              class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            >
              {{ t('portal.quotations.payment_terms') }}
            </p>
            <p class="text-sm font-medium">{{ quote.paymentTerms }}</p>
          </div>

          <!-- Sale contact -->
          <div
            data-testid="sale-contact"
            class="border-border space-y-1 rounded-lg border p-4"
          >
            <p
              class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            >
              {{ t('portal.quotations.sale_contact') }}
            </p>
            <p class="text-sm font-medium">{{ quote.contactName }}</p>
            <p class="text-muted-foreground text-sm">
              {{ quote.contactEmail }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
