<script setup lang="ts">
import type { DetailProduct } from '#shared/types/commerce';

/**
 * The page a configurable product gets.
 *
 * A shell: heading, image and the region the configuration form lands in.
 * Nothing from the CPQ contract is mounted here yet — no session is started,
 * no document is read. The product arrives from the route, which has already
 * loaded it; this component makes no request of its own.
 */
const { product } = defineProps<{ product: DetailProduct }>();

const primaryImage = computed(() => {
  const images = product.productImages ?? [];
  return images.find((image) => image.isPrimary) ?? images[0];
});

const { localePath } = useLocaleMarket();
const { buildProductImageAlt } = useProductImageAlt();
const { t } = useI18n();

const breadcrumbItems = computed(() => {
  const items: { label: string; href?: string }[] = [
    { label: t('common.home'), href: localePath('/') },
  ];
  items.push(...ancestorCrumbs(product.ancestors, localePath));
  if (product.primaryCategory?.name) {
    items.push({ label: product.primaryCategory.name });
  }
  if (product.name) items.push({ label: product.name });
  return items;
});

useHead({ title: () => product.name ?? '' });
</script>

<template>
  <div class="px-4 py-8 lg:px-6" data-testid="configurator-product">
    <div class="mx-auto max-w-7xl space-y-8">
      <AppBreadcrumbs :items="breadcrumbItems" />

      <div class="grid gap-8 lg:grid-cols-2">
        <GeinsImage
          v-if="primaryImage?.fileName"
          :file-name="primaryImage.fileName"
          :alt="
            buildProductImageAlt({
              name: product.name ?? '',
              manualAlt: primaryImage.altText,
            })
          "
          type="product"
          loading="eager"
          fit="contain"
          aspect-ratio="1/1"
        />

        <div class="space-y-4">
          <h1 class="text-2xl font-semibold">{{ product.name }}</h1>
          <p v-if="product.articleNumber" class="text-muted-foreground text-sm">
            {{ product.articleNumber }}
          </p>

          <!-- The configuration form mounts here. -->
          <div data-testid="configurator-form-slot" />
        </div>
      </div>
    </div>
  </div>
</template>
