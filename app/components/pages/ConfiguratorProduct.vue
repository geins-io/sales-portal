<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';
import type { DetailProduct } from '#shared/types/commerce';
import type { ConfigurationChange } from '#shared/types/configurator';
import { categoryPath } from '#shared/utils/route-helpers';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  canCommit,
  configuratorStage,
  headerError,
  type ConfiguratorAction,
} from '~/utils/configurator-page';

/**
 * The page a configurable product gets.
 *
 * It owns the session and every call to it; the form components below hold no
 * session and are given plain props. The product arrives from the route, which
 * has already loaded it, so this component makes no request of its own beyond
 * the configuration.
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
  const category = product.primaryCategory;
  if (category?.name) {
    // An item without an href is rendered as a link to the start page, so the
    // category needs the same canonical-derived href the ordinary product page
    // builds — a bare alias yields `/c/<alias>`, which 301s on every nested one.
    items.push({
      label: category.name,
      href: localePath(
        categoryPath(category.canonicalUrl || `/${category.alias ?? ''}`),
      ),
    });
  }
  if (product.name) items.push({ label: product.name });
  return items;
});

useHead({ title: () => product.name ?? '' });

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------
const {
  configuration,
  committed,
  status,
  busy,
  error,
  remainingMs,
  start,
  applyChanges,
  renew,
  commit,
  release,
} = useConfiguratorSession();

/** Which verb failed last; see `headerError`. */
const lastAction = ref<ConfiguratorAction>('start');

const productId = computed(() => String(product.productId));

onMounted(() => start(productId.value));

const stage = computed(() =>
  configuratorStage({
    status: status.value,
    configuration: configuration.value,
    committed: committed.value,
    error: error.value,
  }),
);

const commitEnabled = computed(() =>
  canCommit({
    status: status.value,
    configuration: configuration.value,
    busy: busy.value,
  }),
);

const forHeader = computed(() => headerError(lastAction.value, error.value));

/** What the page shows itself: everything the header's renew message is not. */
const ownError = computed(() =>
  stage.value === 'form' && lastAction.value !== 'renew' ? error.value : null,
);

/** One change, one batch: the response is the whole document either way. */
function onChange(change: ConfigurationChange): void {
  lastAction.value = 'change';
  void applyChanges([change]);
}

function onRenew(): void {
  lastAction.value = 'renew';
  void renew();
}

function onCommit(): void {
  lastAction.value = 'commit';
  void commit();
}

/**
 * Release first so an expired session is not left behind on the provider. It is
 * a no-op on a session that is already gone, and `start` refuses only an active
 * one, so the same two lines serve both the expired and the committed state.
 */
async function onRestart(): Promise<void> {
  lastAction.value = 'start';
  await release();
  await start(productId.value);
}
</script>

<template>
  <div class="px-4 py-8 lg:px-6" data-testid="configurator-product">
    <div class="mx-auto max-w-7xl space-y-8">
      <AppBreadcrumbs :items="breadcrumbItems" />

      <!--
        One grid for the whole page, placed explicitly: the product sits above
        the form in the left column and the status panel holds the top of the
        right one, level with the product. In source order the panel comes
        between them, which is the order a phone stacks them in — and the order
        a screen reader meets them in: what the configuration costs and whether
        it is complete, before the controls that change it.

        `row-span-2` with `self-start` is what lets the panel stick: the cell it
        is placed in reaches the bottom of the form, while the card keeps its
        own height and travels inside it.
      -->
      <div class="grid gap-x-8 gap-y-6 lg:grid-cols-[1fr_24rem]">
        <div
          class="grid gap-6 sm:grid-cols-[minmax(0,20rem)_1fr] lg:col-start-1 lg:row-start-1"
        >
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

          <div class="space-y-2">
            <h1 class="text-2xl font-semibold">{{ product.name }}</h1>
            <p
              v-if="product.articleNumber"
              class="text-muted-foreground text-sm"
            >
              {{ product.articleNumber }}
            </p>
          </div>
        </div>

        <aside
          v-if="stage !== 'committed'"
          class="lg:sticky lg:top-48 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <!-- The committed summary carries the price it was committed at, so
               the header stands down rather than show a second one beside it. -->
          <Card class="gap-4 p-4">
            <ConfigurationHeader
              :configuration="configuration"
              :status="status"
              :busy="busy"
              :remaining-ms="remainingMs"
              :error="forHeader"
              @renew="onRenew"
              @restart="onRestart"
            />

            <Button
              v-if="stage === 'form'"
              class="w-full"
              size="lg"
              :disabled="!commitEnabled"
              data-testid="configurator-commit"
              @click="onCommit"
            >
              {{ t('configurator.commit') }}
            </Button>
          </Card>
        </aside>

        <div
          class="space-y-6 lg:col-start-1 lg:row-start-2"
          data-testid="configurator-form-slot"
        >
          <p
            v-if="stage === 'loading'"
            class="text-muted-foreground text-sm"
            data-testid="configurator-loading"
          >
            {{ t('configurator.starting') }}
          </p>

          <!-- No retry button: a session that could not be created is a reload,
               not a second POST from a page holding half a state. -->
          <p
            v-else-if="stage === 'error'"
            class="text-destructive flex items-start gap-2 text-sm"
            data-testid="configurator-error"
          >
            <AlertCircle class="mt-0.5 size-4 shrink-0" />
            {{ t('configurator.failed') }}
          </p>

          <ConfiguratorCommitted
            v-else-if="stage === 'committed' && committed"
            :committed="committed"
          />

          <template v-else-if="stage === 'form' && configuration">
            <p
              v-if="ownError"
              class="text-destructive flex items-start gap-2 text-sm"
              data-testid="configurator-form-error"
            >
              <AlertCircle class="mt-0.5 size-4 shrink-0" />
              {{ t('configurator.failed') }}
            </p>

            <ConfiguratorSection
              v-for="section in configuration.sections"
              :key="section.id"
              :section="section"
              :disabled="busy"
              @change="onChange"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
