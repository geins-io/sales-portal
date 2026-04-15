<script setup lang="ts">
import { Button } from '~/components/ui/button';
import { useQuotesStore } from '~/stores/quotes';
import { safeConfirm } from '~/utils/client-helpers';
import { getQuoteStatusPillClass } from '~/utils/quote-status';
import type { Quote } from '#shared/types/quote';

definePageMeta({ middleware: 'auth' });

const { t, locale } = useI18n();
const route = useRoute();
const store = useQuotesStore();
const { localePath } = useLocaleMarket();

const quoteId = computed(() => route.params.id as string);

// SSR-safe 404: fetch at top-level setup so Nuxt can set the response status
// before the HTML is streamed. Sibling routes (accept/reject) under
// /api/quotes/[id] can cause union inference, so explicitly type the generic.
const { data, error } = await useFetch<{ quote: Quote }>(
  () => `/api/quotes/${quoteId.value}`,
  { dedupe: 'defer' },
);

if (error.value || !data.value?.quote) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Quotation not found',
    fatal: true,
  });
}

// Seed the Pinia store so accept/reject mutations have the latest snapshot.
// Clear any stale error from a previous route so the banner starts hidden.
store.currentQuote = data.value.quote;
store.error = null;

const quote = computed<Quote | null>(() => data.value?.quote ?? null);
const isPending = computed(() => quote.value?.status === 'pending');

useHead({
  title: computed(
    () =>
      quote.value?.name ??
      `${t('portal.quotations.detail_title')} #${quote.value?.quoteNumber ?? ''}`,
  ),
});

async function handleAccept() {
  if (!quote.value) return;
  await store.acceptQuote(quote.value.id);
}

async function handleDecline() {
  if (!quote.value) return;
  if (!safeConfirm(t('portal.quotations.decline_confirm'))) return;
  await store.rejectQuote(quote.value.id);
}

function statusLabel(status: string): string {
  return t(`portal.quotations.status_${status}`);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value, {
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
      <!-- Back to quotations link -->
      <NuxtLink
        data-testid="back-link"
        :to="localePath('/portal/quotations')"
        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <Icon name="lucide:arrow-left" class="size-4" />
        {{ t('portal.quotations.back_to_quotations') }}
      </NuxtLink>

      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 data-testid="quote-title" class="text-2xl font-semibold">
            {{
              quote?.name ??
              `${t('portal.quotations.detail_title')} #${quote?.quoteNumber ?? ''}`
            }}
          </h2>
          <p class="text-muted-foreground mt-1 text-sm">
            {{ formatDate(quote.createdAt) }}
          </p>
        </div>
        <span
          data-testid="status-badge"
          class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          :class="getQuoteStatusPillClass(quote.status)"
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
                      <ProductThumbnail
                        :file-name="item.imageFileName"
                        :alt="item.name"
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
                t('portal.quotations.subtotal_with_count', {
                  count: quote?.lineItems?.length ?? 0,
                })
              }}</span>
              <span>{{ quote.subtotalFormatted }}</span>
            </div>
            <div
              v-if="(quote?.shipping ?? 0) > 0"
              data-testid="shipping-row"
              class="flex justify-between text-sm"
            >
              <span class="text-muted-foreground">{{
                t('portal.quotations.shipping')
              }}</span>
              <span>{{ quote.shippingFormatted }}</span>
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
          <div v-if="isPending" class="flex flex-col gap-2">
            <div
              v-if="store.error"
              data-testid="action-error"
              role="alert"
              class="bg-destructive/10 text-destructive border-destructive/20 mb-2 rounded-md border px-3 py-2 text-sm"
            >
              {{ t(store.error) }}
            </div>
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
              @click="handleDecline"
            >
              {{
                store.isActionLoading
                  ? t('portal.quotations.declining')
                  : t('portal.quotations.decline')
              }}
            </Button>
          </div>

          <!-- Expiration date -->
          <div
            v-if="quote?.expiresAt"
            data-testid="expires-at"
            class="border-border flex items-start gap-3 rounded-lg border p-4"
          >
            <Icon
              name="lucide:calendar"
              class="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div class="space-y-1">
              <p
                class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
              >
                {{ t('portal.quotations.expires_at') }}
              </p>
              <p class="text-sm font-medium">
                {{ formatDate(quote.expiresAt) }}
              </p>
            </div>
          </div>

          <!-- Payment terms -->
          <div
            v-if="quote?.paymentTerms"
            data-testid="payment-terms"
            class="border-border flex items-start gap-3 rounded-lg border p-4"
          >
            <Icon
              name="lucide:clock"
              class="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div class="space-y-1">
              <p
                class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
              >
                {{ t('portal.quotations.payment_terms') }}
              </p>
              <p class="text-sm font-medium">{{ quote.paymentTerms }}</p>
            </div>
          </div>

          <!-- Sale contact -->
          <div
            data-testid="sale-contact"
            class="border-border flex items-start gap-3 rounded-lg border p-4"
          >
            <Icon
              name="lucide:user"
              class="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <div class="space-y-1">
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

          <!-- Customer information -->
          <div
            v-if="quote?.company"
            data-testid="customer-info"
            class="border-border space-y-1 rounded-lg border p-4"
          >
            <p
              class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            >
              {{ t('portal.quotations.customer_info') }}
            </p>
            <p v-if="quote?.company?.name" class="text-sm font-medium">
              {{ quote.company.name }}
            </p>
            <p
              v-if="quote?.company?.companyId"
              class="text-muted-foreground text-sm"
            >
              {{ t('portal.quotations.org_number') }}:
              {{ quote.company.companyId }}
            </p>
            <p
              v-if="quote?.company?.vatNumber"
              class="text-muted-foreground text-sm"
            >
              {{ t('portal.quotations.vat_number') }}:
              {{ quote.company.vatNumber }}
            </p>
          </div>

          <!-- Invoice address -->
          <AddressBlock
            v-if="quote?.billingAddress"
            data-testid="invoice-address"
            :label="t('portal.quotations.invoice_address')"
            :address="quote.billingAddress"
          />

          <!-- Delivery address -->
          <AddressBlock
            v-if="quote?.shippingAddress"
            data-testid="delivery-address"
            :label="t('portal.quotations.delivery_address')"
            :address="quote.shippingAddress"
          />
        </div>
      </div>
    </div>
  </PortalShell>
</template>
