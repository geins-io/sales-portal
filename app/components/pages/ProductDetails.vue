<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { filterVisibleCampaigns } from '#shared/types/commerce';
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import { BADGE_DESTRUCTIVE } from '~/lib/badge-styles';
import {
  AlertTriangle as AlertTriangleIcon,
  BadgeCheck,
  Download,
  ListPlus,
  ShoppingCart,
  Star,
} from 'lucide-vue-next';
import { useCartStore } from '~/stores/cart';
import { useFavoritesStore } from '~/stores/favorites';
import { useAuthStore } from '~/stores/auth';

const props = defineProps<{
  alias: string;
}>();

const slug = computed(() => props.alias);

const { localeQuery } = useLocaleMarket();

const {
  data: product,
  error,
  status,
} = await useFetch<DetailProduct>(() => `/api/products/${slug.value}`, {
  query: localeQuery,
  dedupe: 'defer',
});

// Propagate HTTP 404 when the product doesn't exist. Without this the
// page rendered an empty state with 200 and crawlers would index
// phantom URLs.
if (error.value || !product.value?.productId) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    fatal: true,
  });
}

const isLoading = computed(() => status.value === 'pending');

const { data: related } = useFetch<ListProduct[]>(
  () => `/api/products/${slug.value}/related`,
  {
    query: localeQuery,
    dedupe: 'defer',
    lazy: true,
  },
);

// Variant state
const selectedVariants = ref<Record<string, string>>({});

const resolvedSku = computed(() => {
  if (!product.value?.variantGroup?.variants?.length) {
    return product.value?.skus?.[0] ?? null;
  }
  const variant = product.value.variantGroup.variants.find((v) =>
    v.attributes?.every(
      (attr) =>
        selectedVariants.value[attr.attributeName] === attr.attributeValue,
    ),
  );
  if (!variant) return product.value.skus?.[0] ?? null;
  return product.value.skus?.find((s) => s.skuId === variant.variantId) ?? null;
});

const quantity = ref(1);

const maxQuantity = computed(() => {
  const stock = product.value?.totalStock?.totalStock;
  return stock && stock > 0 ? stock : 99;
});

const cartStore = useCartStore();
const favoritesStore = useFavoritesStore();
const authStore = useAuthStore();
const { hasFeature, isCatalogMode } = useTenant();
const { localePath } = useLocaleMarket();
const { showPrice } = usePriceVisibility();

const isFavorited = computed(() =>
  product.value ? favoritesStore.isFavorite(product.value.alias) : false,
);

const showListPicker = ref(false);

function openListPicker() {
  if (!product.value) return;
  showListPicker.value = true;
}

function toggleFavourite() {
  if (!product.value) return;
  favoritesStore.toggle(product.value.alias);
}

function printDataSheet() {
  if (import.meta.client) window.print();
}

// Plain-text variants of CMS-authored copy. Text 1 lands under the price
// and Text 3 under the product details block; both fields may contain
// editor HTML, but the top-area inlines render as small body copy and
// the markup would otherwise leak as visible angle brackets.
function stripHtml(value: string | null | undefined): string {
  return value ? value.replace(/<[^>]*>/g, '').trim() : '';
}

const text3Plain = computed(() => stripHtml(product.value?.texts?.text3));

// Full canonical URL used on the print header row 2 and as the source
// for the alias path in the additional-images grid caption.
const printUrl = computed(() => {
  const url = useRequestURL();
  return `${url.origin}${url.pathname}`;
});

// Additional images beyond the primary, rendered only on print under
// the "Ytterligare bilder" heading. The primary image is dropped from
// the list — it's already in the gallery on the top area card. Geins
// returns ProductImage with `fileName` (the CDN slug); GeinsImage
// builds the actual URL at render time.
const additionalImages = computed(() => {
  const images = product.value?.productImages ?? [];
  if (images.length <= 1) return [];
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return images.filter((i) => i.fileName && i !== primary);
});

// Last-ordered summary for this product. Auth-gated, lazy — skips
// the fetch entirely for anonymous visitors (the common case).
const { latestOrder, formattedDate: latestOrderDate } =
  useLatestOrderForAlias(slug);

// The variant selector renders for two distinct shapes Geins returns.
// Internal multi-SKU products surface their variants in `product.skus`
// (length > 1). Sibling-variant products are wrapped in a
// `variantGroup` so each variant value is a separate product alias;
// the current product's `skus` stays at 1 but `variantGroup.variants`
// carries the siblings.
const showVariantSelector = computed(() => {
  const dims = product.value?.variantDimensions ?? [];
  if (!dims.length) return false;
  const skuCount = product.value?.skus?.length ?? 0;
  const siblingCount = product.value?.variantGroup?.variants?.length ?? 0;
  return skuCount > 1 || siblingCount > 1;
});

// --- CMS zone on PDP (tenant-configurable via CMS_SLOTS.PRODUCT_DETAIL) ---
// Rendered below the related-products row when the slot is configured
// and the area has content. Missing slot or empty area simply omits
// the zone — product info is the primary content.
const { currentLocale, currentMarket } = useLocaleMarket();
const pdpSlot = useCmsSlot(CMS_SLOTS.PRODUCT_DETAIL);

const { data: pdpCmsArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    pdpSlot.value
      ? {
          family: pdpSlot.value.family,
          areaName: pdpSlot.value.areaName,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!pdpSlot.value,
  dedupe: 'defer',
  lazy: true,
});

async function addToCart() {
  if (!resolvedSku.value?.skuId) return;
  await cartStore.addItem(resolvedSku.value.skuId, quantity.value);
}

// Sibling-variant products list each variant as its own product alias
// in variantGroup.variants. When the user picks a different variant in
// the selector, navigate to that variant's PDP rather than mutating
// state in place. Keeps the path prefix segments (e.g. /material/grenror)
// and swaps the last segment for the picked variant's alias.
const route = useRoute();
watch(
  selectedVariants,
  async (sel) => {
    const variants = product.value?.variantGroup?.variants ?? [];
    if (!variants.length || !product.value?.alias) return;
    const picked = variants.find((v) => {
      const dim = (v as { dimension?: string }).dimension;
      const val = (v as { value?: string | null }).value;
      if (dim && val != null) return sel[dim] === val;
      const attrs = Array.isArray(v.attributes) ? v.attributes : [];
      return attrs.every((attr) => {
        const k =
          (attr as { attributeName?: string; key?: string }).attributeName ??
          (attr as { key?: string }).key;
        const a =
          (attr as { attributeValue?: string; value?: string })
            .attributeValue ?? (attr as { value?: string }).value;
        return k ? sel[k] === a : true;
      });
    }) as { alias?: string } | undefined;
    if (!picked?.alias || picked.alias === product.value.alias) return;
    const raw = route.params.alias;
    const segs = Array.isArray(raw) ? [...raw] : raw ? [raw as string] : [];
    if (segs.length) segs[segs.length - 1] = picked.alias;
    else segs.push(picked.alias);
    await navigateTo(localePath(`/p/${segs.join('/')}`));
  },
  { deep: true },
);

// Discount campaigns
const visibleCampaigns = computed(() =>
  filterVisibleCampaigns(product.value?.discountCampaigns ?? []),
);

// Breadcrumbs
const { t } = useI18n();

const breadcrumbItems = computed(() => {
  const items: { label: string; href?: string }[] = [
    { label: t('common.home'), href: localePath('/') },
  ];

  // Extract category from the product's primaryCategory if available
  const category = product.value?.primaryCategory;
  if (category?.name) {
    const catAlias = category.alias || category.name.toLowerCase();
    items.push({
      label: category.name,
      href: localePath(`/c/${catAlias}`),
    });
  }

  if (product.value?.name) {
    items.push({ label: product.value.name });
  }

  return items;
});

// SEO
const plainDescription = computed(
  () =>
    product.value?.texts?.text1?.replace(/<[^>]*>/g, '').slice(0, 160) ?? '',
);

const primaryImageUrl = computed(
  () =>
    product.value?.productImages?.find((i) => i.isPrimary)?.url ??
    product.value?.productImages?.[0]?.url ??
    '',
);

const productPath = computed(() => `/p/${slug.value}`);
const { seoLinks } = useSeoLinks(productPath);

useHead({
  title: () => product.value?.name ?? '',
});

useSeoMeta({
  description: () => plainDescription.value,
  ogTitle: () => product.value?.name ?? '',
  ogDescription: () => plainDescription.value,
  ogImage: () => primaryImageUrl.value || undefined,
  ogUrl: () => seoLinks.value.find((l) => l.rel === 'canonical')?.href ?? '',
});

// JSON-LD structured data (Schema.org Product + BreadcrumbList)
useSchemaOrg([
  defineProduct({
    name: () => product.value?.name ?? '',
    description: () => plainDescription.value,
    image: () =>
      product.value?.productImages?.map((img) => img.url).filter(Boolean) ?? [],
    brand: () =>
      product.value?.brand?.name
        ? { '@type': 'Brand', name: product.value.brand.name }
        : undefined,
    sku: () => resolvedSku.value?.skuId?.toString() ?? '',
    offers: () =>
      product.value?.unitPrice
        ? {
            '@type': 'Offer' as const,
            price: product.value.unitPrice.sellingPriceIncVat ?? 0,
            priceCurrency: product.value.unitPrice.currency?.code ?? 'SEK',
            availability: product.value.totalStock?.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition',
          }
        : undefined,
    aggregateRating: () =>
      product.value?.rating?.reviewCount
        ? {
            '@type': 'AggregateRating' as const,
            ratingValue: product.value.rating.averageRating ?? 0,
            reviewCount: product.value.rating.reviewCount,
          }
        : undefined,
  }),
  defineBreadcrumb({
    itemListElement: () =>
      breadcrumbItems.value.map((bc, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        name: bc.label,
        item: bc.href,
      })),
  }),
]);
</script>

<template>
  <!-- Loading skeleton -->
  <ProductDetailsSkeleton
    v-if="isLoading && !product"
    data-testid="pdp-loading"
  />

  <!-- Error state -->
  <EmptyState
    v-else-if="error"
    :icon="AlertTriangleIcon"
    :title="$t('product.failed_to_load')"
    :description="$t('common.something_went_wrong')"
    action-label="Home"
    :action-to="localePath('/')"
    data-testid="pdp-error"
  />

  <div
    v-else-if="product"
    class="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-6"
  >
    <!-- Print-only header: store logo + timestamp + product URL.
         Hidden on screen, shown via @media print. -->
    <PrintHeader :product-url="printUrl" />

    <!-- Breadcrumbs -->
    <AppBreadcrumbs v-if="breadcrumbItems.length" :items="breadcrumbItems" />

    <!-- PDP top area: 3-column layout per Figma
         lg+: gallery (max 400) | main info | right card
         md:  gallery + info on first row, right card below
         mobile: stacked single column -->
    <div
      class="bg-card grid gap-6 rounded-lg border p-4 md:p-6 lg:grid-cols-[400px_1fr_280px] lg:gap-9"
      data-testid="pdp-top-area"
    >
      <!-- Left: Gallery -->
      <ErrorBoundary section="product-gallery">
        <ProductGallery
          v-if="product.productImages?.length"
          :images="product.productImages"
          :product-name="product.name ?? ''"
          class="w-full max-w-[400px]"
        />
      </ErrorBoundary>

      <!-- Middle: Product info -->
      <div class="flex flex-col gap-4">
        <!-- Product name + meta -->
        <div class="flex flex-col gap-1">
          <h1
            class="font-heading text-3xl leading-tight font-bold lg:text-4xl"
            data-testid="product-name"
          >
            {{ product.name }}
          </h1>

          <!-- Article number -->
          <p
            v-if="product.articleNumber"
            class="text-muted-foreground text-sm"
            data-testid="product-article-number"
          >
            Art nr. {{ product.articleNumber }}
          </p>

          <!-- Brand -->
          <p
            v-if="product.brand?.name"
            class="text-muted-foreground text-sm"
            data-testid="product-brand"
          >
            {{ product.brand.name }}
          </p>

          <!-- Text 3: extra detail copy under the product header -->
          <p
            v-if="text3Plain"
            class="text-muted-foreground mt-1 text-sm leading-relaxed"
            data-testid="product-text3"
          >
            {{ text3Plain }}
          </p>
        </div>

        <!-- Campaign badges -->
        <div
          v-if="visibleCampaigns.length"
          class="flex flex-wrap gap-1"
          data-testid="pdp-campaign-badges"
        >
          <span
            v-for="campaign in visibleCampaigns"
            :key="campaign.name"
            :class="BADGE_DESTRUCTIVE"
          >
            {{ campaign.name }}
          </span>
        </div>

        <!-- Price -->
        <PriceDisplay
          v-if="product.unitPrice"
          :price="product.unitPrice"
          :lowest-price="product.lowestPrice"
          :discount-type="product.discountType"
          :campaign-names="visibleCampaigns.map((c) => c.name)"
          class="text-2xl font-bold"
        />

        <!-- Negotiated price info banner -->
        <div
          v-if="product.discountType === 'EXTERNAL'"
          class="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
          data-testid="negotiated-price-banner"
        >
          <BadgeCheck class="size-4 shrink-0" />
          <span>{{ $t('discount.negotiated_price_info') }}</span>
        </div>

        <!-- Stock -->
        <div v-if="product.totalStock" data-testid="stock-badge">
          <StockBadge :stock="product.totalStock" />
        </div>

        <!-- Variant selector — pass product-level data through so each
             sheet row can render a real Figma-style item with thumbnail,
             art-nr, stock and price (price is product-level so it's the
             same on every row). -->
        <VariantSelector
          v-if="showVariantSelector"
          v-model="selectedVariants"
          :variant-dimensions="product.variantDimensions ?? []"
          :variants="product.variantGroup?.variants ?? []"
          :skus="product.skus ?? []"
          :product-images="product.productImages ?? []"
          :product-name="product.name ?? ''"
          :price-formatted="
            product.unitPrice?.sellingPriceIncVatFormatted ?? null
          "
          :product-article-number="product.articleNumber ?? null"
        />
      </div>

      <!-- Right: actions + info card -->
      <aside class="flex flex-col gap-4">
        <!-- Quantity + Add to cart + Wishlist -->
        <div
          v-if="showPrice && !isCatalogMode"
          class="flex items-center gap-2"
          data-testid="pdp-actions"
        >
          <QuantityInput
            v-model="quantity"
            :min="1"
            :max="maxQuantity"
            class="h-9 shrink-0"
          />
          <Button
            variant="purchase"
            data-testid="add-to-cart-button"
            class="h-9 flex-1 gap-2 px-4"
            @click="addToCart"
          >
            <ShoppingCart class="size-4" />
            {{ $t('product.add_to_cart') }}
          </Button>
        </div>

        <!-- Info links: borderless block with separator lines top + bottom.
             Order per Figma: Download data sheet, Save as favourites,
             Add to lists, optional latest-order info below. -->
        <div
          class="border-border flex flex-col divide-y border-y"
          data-testid="pdp-info-card"
        >
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-3 text-left text-sm transition-colors"
            data-testid="pdp-print"
            @click="printDataSheet"
          >
            <Download class="size-4" />
            <span>{{ $t('product.download_data_sheet') }}</span>
          </button>
          <button
            v-if="hasFeature('wishlist') && authStore.isAuthenticated"
            type="button"
            class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-3 text-left text-sm transition-colors"
            data-testid="pdp-save-favourite"
            @click="toggleFavourite"
          >
            <Star class="size-4" />
            <span>
              {{
                isFavorited
                  ? $t('product.saved_as_favourite')
                  : $t('product.save_as_favourite')
              }}
            </span>
          </button>
          <button
            v-if="authStore.isAuthenticated"
            type="button"
            class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-3 text-left text-sm transition-colors"
            data-testid="pdp-add-to-lists"
            @click="openListPicker"
          >
            <ListPlus class="size-4" />
            <span>{{ $t('product.add_to_lists') }}</span>
          </button>
          <NuxtLink
            v-if="latestOrder"
            :to="
              latestOrder.latestOrderPublicId
                ? localePath(
                    `/portal/orders/${latestOrder.latestOrderPublicId}`,
                  )
                : localePath('/portal/orders')
            "
            class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-3 text-left text-sm transition-colors"
            data-testid="pdp-latest-ordered"
          >
            <ShoppingCart class="size-4" />
            <span>
              {{ $t('product.latest_ordered') }}: {{ latestOrderDate }}
              <template v-if="latestOrder.latestOrderId">
                ({{ latestOrder.latestOrderId }})
              </template>
            </span>
          </NuxtLink>
        </div>
      </aside>
    </div>

    <!-- Product tabs (full width) -->
    <ErrorBoundary section="product-tabs">
      <ProductTabs :product="product" :related="related" />
    </ErrorBoundary>

    <!-- Print-only: extra product images in a 3-col grid, gated on the
         product having more than one image so the section disappears
         cleanly when there is nothing to show. -->
    <section
      v-if="additionalImages.length"
      class="hidden"
      data-testid="pdp-print-extra-images"
    >
      <h3 class="font-heading mb-3 text-xl font-semibold">
        {{ $t('product.print_extra_images') }}
      </h3>
      <div class="grid grid-cols-3 gap-3">
        <GeinsImage
          v-for="img in additionalImages"
          :key="img.fileName ?? ''"
          :file-name="img.fileName ?? ''"
          :alt="product.name ?? ''"
          type="product"
          loading="eager"
          fit="contain"
          aspect-ratio="1/1"
        />
      </div>
    </section>

    <!-- CMS zone on PDP (tenant-configurable via CMS_SLOTS.PRODUCT_DETAIL).
         Omitted when unconfigured or empty. -->
    <CmsWidgetArea
      v-if="pdpCmsArea?.containers?.length"
      data-testid="pdp-cms-area"
      :containers="pdpCmsArea.containers"
    />

    <AddToListDialog
      v-if="product"
      v-model:open="showListPicker"
      :product-alias="product.alias"
    />
  </div>
</template>
