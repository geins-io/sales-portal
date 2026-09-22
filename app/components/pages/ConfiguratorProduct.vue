<script setup lang="ts">
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-vue-next';
import type { ContentAreaType } from '#shared/types/cms';
import { CMS_SLOTS } from '#shared/types/cms-slots';
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import type { ConfigurationChange } from '#shared/types/configurator';
import { ancestorCrumbs } from '#shared/utils/breadcrumb-trail';
import { categoryPath } from '#shared/utils/route-helpers';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  canCommit,
  configuratorStage,
  headerError,
  type ConfiguratorAction,
} from '~/utils/configurator-page';
import {
  activeIndex,
  flattenVisibleSections,
  hasNext,
  hasPrevious,
  resolveActiveId,
  sectionCrumbs,
  stepId,
  visibleChildren,
} from '~/utils/configurator-sections';
import {
  CONFIGURATION_TAB_ID,
  configuratorTabs,
  productDescriptionTexts,
  visibleParameterGroups,
  type ProductTabValue,
} from '~/utils/product-tabs';

/**
 * The page a configurable product gets.
 *
 * It owns the session and every call to it; the form components below hold no
 * session and are given plain props. The product arrives from the route, which
 * has already loaded it, so this component makes no request of its own beyond
 * the configuration and what every product page asks for.
 */
const { product, alias } = defineProps<{
  product: DetailProduct;
  /**
   * The alias from the URL, which is not always the loaded product's own:
   * under a locale fallback the default-language product answers at the
   * requested address. The canonical and the related row follow the address
   * the visitor is on, exactly as the ordinary product page does.
   */
  alias: string;
}>();

const { localePath, localeQuery, currentLocale, currentMarket } =
  useLocaleMarket();
const { buildProductImageAlt } = useProductImageAlt();
const { t } = useI18n();

const { data: related } = useFetch<ListProduct[]>(
  () => `/api/products/${alias}/related`,
  { query: localeQuery, dedupe: 'defer', lazy: true },
);

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

// Publish this product's per-locale alternate URLs so the language switcher
// can land on the target-language slug instead of the current one.
const { setAlternates, alternates: localeAlternates } = useLocaleAlternates();
watch(
  () => product,
  (p) => setAlternates(p?.alternativeUrls, { type: 'product' }),
  { immediate: true },
);

// No `offers`: what a configured product costs is settled by the configuration,
// so there is no single price to publish before it is committed.
useProductSeo({
  product: () => product,
  path: () => `/p/${alias}`,
  breadcrumbs: () => breadcrumbItems.value,
  localeAlternates,
  withOffers: false,
});

const printUrl = computed(() => {
  const url = useRequestURL();
  return `${url.origin}${url.pathname}`;
});

function printDataSheet() {
  if (isBrowser()) window.print();
}

// Additional images beyond the primary, rendered only on print — the primary
// is already in the gallery on the top card.
const additionalImages = computed(() => {
  const images = product.productImages ?? [];
  if (images.length <= 1) return [];
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return images.filter((i) => i.fileName && i !== primary);
});

const pdpSlot = useCmsSlot(CMS_SLOTS.PRODUCT_DETAIL);

// Page context for the CMS container filters, resolved as in ProductDetails.
// The loaded product's own alias is what the filter references, not the URL
// `alias`, which under a locale fallback belongs to the default-language sibling.
const cmsCategoryIds = computed(() => (product.categoryIds ?? []).join(','));

const pdpCmsContext = computed(() => ({
  ...(product.alias ? { productAlias: product.alias } : {}),
  ...(product.brand?.alias ? { brandAlias: product.brand.alias } : {}),
  ...(cmsCategoryIds.value ? { categoryIds: cmsCategoryIds.value } : {}),
}));

const { data: pdpCmsArea } = useFetch<ContentAreaType>('/api/cms/area', {
  query: computed(() =>
    pdpSlot.value
      ? {
          family: pdpSlot.value.family,
          areaName: pdpSlot.value.areaName,
          ...pdpCmsContext.value,
          ...(currentLocale.value ? { locale: currentLocale.value } : {}),
          ...(currentMarket.value ? { market: currentMarket.value } : {}),
        }
      : { skip: '1' },
  ),
  immediate: !!pdpSlot.value,
  dedupe: 'defer',
  lazy: true,
});

// ---------------------------------------------------------------------------
// The tab row
// ---------------------------------------------------------------------------

const descriptionTexts = computed(() => productDescriptionTexts(product));
const hasDescription = computed(
  () => !!(descriptionTexts.value.text2 || descriptionTexts.value.text3),
);
const visibleGroups = computed(() =>
  visibleParameterGroups(product.parameterGroups),
);
const hasSpecs = computed(() => visibleGroups.value.length > 0);
const hasRelated = computed(() => (related.value?.length ?? 0) > 0);

const tabs = computed(() =>
  configuratorTabs({
    hasDescription: hasDescription.value,
    hasSpecs: hasSpecs.value,
    hasRelated: hasRelated.value,
  }),
);

const activeTab = ref<ProductTabValue>('configuration');

useProductTabPrint();

/** The top card's call to action: open the configuration tab and go there. */
function showConfiguration(): void {
  activeTab.value = 'configuration';
  document
    .getElementById(CONFIGURATION_TAB_ID)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

// ---------------------------------------------------------------------------
// The rail
//
// One section at a time, with every visible section of the tree beside it. The
// entries are empty unless a document is on screen, so the loading, error,
// expired and committed faces render exactly as they did.
// ---------------------------------------------------------------------------
const railEntries = computed(() =>
  stage.value === 'form' && configuration.value
    ? flattenVisibleSections(configuration.value.sections)
    : [],
);

const activeSectionId = ref<string | null>(null);

// Every change batch returns a whole new document, so the section the buyer
// stands on can arrive hidden or gone; `resolveActiveId` answers where to stand
// then. Clicking an entry does not run this: the entries are unchanged.
watch(
  railEntries,
  (entries, previous) => {
    // The rail as it was is what says which entry came before the one that
    // vanished; on the first run there is none, and the first entry is right.
    activeSectionId.value = resolveActiveId(
      entries,
      activeSectionId.value,
      previous ?? [],
    );
  },
  { immediate: true },
);

const activeRailIndex = computed(() =>
  activeIndex(railEntries.value, activeSectionId.value),
);

const activeEntry = computed(() => railEntries.value[activeRailIndex.value]);

/** The trail to the active section, its own entry last. */
const crumbs = computed(() =>
  sectionCrumbs(railEntries.value, activeSectionId.value),
);

/**
 * The pages under the active section, and whether the section is a way in
 * rather than a page of its own.
 *
 * Two or more, and the section's own content stays unrendered: the first thing
 * to do there is pick a branch, and offering the choices under a form the buyer
 * has not reached yet buries them. One child is no choice to make, so the
 * section renders itself and `Next` carries on into it.
 */
const activeChildren = computed(() =>
  activeEntry.value ? visibleChildren(activeEntry.value.section) : [],
);

const isMenu = computed(() => activeChildren.value.length >= 2);

/**
 * A middle level with children and nothing of its own to answer. Without the
 * list the page would be a heading over an empty column, so the children are
 * offered the way the menu offers them.
 */
const listsChildrenInstead = computed(() => {
  const section = activeEntry.value?.section;
  if (!section || isMenu.value) return false;
  return (
    activeChildren.value.length > 0 &&
    section.optionGroups.length === 0 &&
    section.variables.length === 0
  );
});

const canStepBack = computed(() => hasPrevious(activeRailIndex.value));

const canStepForward = computed(() =>
  hasNext(activeRailIndex.value, railEntries.value.length),
);

function step(delta: number): void {
  activeSectionId.value = stepId(
    railEntries.value,
    activeRailIndex.value,
    delta,
  );
}

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
      <!-- Print-only header: store logo + timestamp + product URL. -->
      <PrintHeader :product-url="printUrl" />

      <AppBreadcrumbs :items="breadcrumbItems" />

      <ProductTopArea :product="product">
        <template #aside>
          <Button
            variant="purchase"
            class="w-full gap-2"
            data-testid="configurator-cta"
            @click="showConfiguration"
          >
            <SlidersHorizontal class="size-4" />
            {{ t('configurator.configure_product') }}
          </Button>

          <!-- The ordinary page's other rows (favourite, lists, latest
               ordered) are deliberately absent until they are asked for. -->
          <div
            class="border-border flex flex-col border-y"
            data-testid="pdp-info-card"
          >
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground flex items-center gap-2 py-2.5 text-left text-[13px] transition-colors"
              data-testid="pdp-print"
              @click="printDataSheet"
            >
              <Download class="size-4" />
              <span>{{ t('product.download_data_sheet') }}</span>
            </button>
          </div>

          <!-- The tab's own name is lifted out of the sentence, as the
               prototype does, so the buyer sees where to go. -->
          <i18n-t
            keypath="configurator.page_note"
            tag="p"
            class="text-muted-foreground text-xs"
          >
            <template #tab>
              <span class="text-foreground font-medium">
                {{ t('configurator.product_configuration') }}
              </span>
            </template>
          </i18n-t>
        </template>
      </ProductTopArea>

      <!--
        One tab row at every width, unlike the ordinary product page's
        accordion below md: the configuration is what this page is for, and an
        accordion branch would mount the form a second time — two copies of one
        session's controls.
      -->
      <!-- scroll-mt-44 is the sticky header's 11rem: without it the call to
           action scrolls the tab row under the header. -->
      <Tabs
        :id="CONFIGURATION_TAB_ID"
        v-model="activeTab"
        class="scroll-mt-44"
        data-testid="product-tabs"
      >
        <TabsList variant="underline">
          <TabsTrigger
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            :data-testid="`configurator-tab-${tab.value}`"
          >
            {{ t(tab.labelKey) }}
          </TabsTrigger>
        </TabsList>

        <!-- force-mount, so the form is hidden by the class rather than
             unmounted: the fields hold local state the document does not carry
             back, and a look at the Documents tab would reset it. -->
        <TabsContent
          value="configuration"
          force-mount
          class="bg-card mt-6 rounded-lg border p-6 data-[state=inactive]:hidden"
        >
          <!--
            Source order is the prototype's: heading, rail and form, status
            panel, which is how a phone stacks them. The heading spans the rail
            as well as the form, so the left side is one column holding a
            heading and an inner grid rather than three cells placed by hand.
          -->
          <div class="grid gap-6 lg:grid-cols-[1fr_306px] lg:items-start">
            <div class="min-w-0">
              <div
                class="border-border mb-6 flex items-center justify-between gap-3 border-b pb-4"
              >
                <h3 class="font-heading text-2xl font-bold">
                  {{ t('configurator.product_configuration') }}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-muted-foreground shrink-0 gap-1.5"
                  data-testid="configurator-reset"
                  @click="onRestart"
                >
                  <RotateCcw class="size-4" />
                  {{ t('configurator.reset') }}
                </Button>
              </div>

              <div class="grid gap-6 lg:grid-cols-[254px_1fr] lg:items-start">
                <!-- Below lg the rail is hidden and the pager carries
                     navigation. No rail when there is nothing to list: a
                     document with no visible section has nothing to configure,
                     and an empty rail would be a frame around nothing. -->
                <nav
                  v-if="railEntries.length"
                  class="hidden lg:sticky lg:top-48 lg:block"
                  data-testid="configurator-rail"
                >
                  <p
                    class="text-muted-foreground mb-2 px-2 text-[11px] font-medium tracking-wider uppercase"
                  >
                    {{ t('configurator.sections') }}
                  </p>
                  <ul class="space-y-0.5">
                    <li v-for="entry in railEntries" :key="entry.section.id">
                      <!-- Depth is in the number, not in an indent: the number
                           sits in a fixed column and every title starts at the
                           same edge, so the width never runs out however deep
                           the tree goes. -->
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-2 rounded-md border-l-2 py-1.5 pr-2 pl-2 text-left text-sm transition-colors"
                        :class="
                          entry.section.id === activeSectionId
                            ? 'border-primary bg-muted text-foreground font-medium'
                            : 'text-muted-foreground hover:bg-muted/60 border-transparent'
                        "
                        data-testid="configurator-rail-entry"
                        :data-section-id="entry.section.id"
                        :data-number="entry.number"
                        :data-active="
                          String(entry.section.id === activeSectionId)
                        "
                        @click="activeSectionId = entry.section.id"
                      >
                        <span class="flex min-w-0 items-center gap-2">
                          <span
                            class="w-8 shrink-0 text-[11px] tabular-nums"
                            data-testid="configurator-rail-number"
                          >
                            {{ entry.number }}
                          </span>
                          <span class="truncate">{{ entry.section.name }}</span>
                        </span>
                        <span
                          v-if="entry.remaining"
                          class="bg-warning/10 text-warning shrink-0 rounded-full px-1.5 text-[10px] font-medium"
                          data-testid="configurator-rail-remaining"
                        >
                          {{
                            t('configurator.remaining', {
                              count: entry.remaining,
                            })
                          }}
                        </span>
                      </button>
                    </li>
                  </ul>
                </nav>

                <!-- The rule down the left is the prototype's frame around the
                     active section. It goes when the rail does: with nothing to
                     navigate it would frame a loading line. -->
                <div
                  class="min-w-0"
                  :class="
                    railEntries.length
                      ? 'border-border space-y-8 border-l pl-6 lg:min-h-[calc(100vh-16rem)]'
                      : 'space-y-6'
                  "
                  data-testid="configurator-form-slot"
                >
                  <p
                    v-if="stage === 'loading'"
                    class="text-muted-foreground text-sm"
                    data-testid="configurator-loading"
                  >
                    {{ t('configurator.starting') }}
                  </p>

                  <!-- No retry button: a session that could not be created is a
                   reload, not a second POST from a page holding half a state. -->
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

                    <!-- Above the header and outside the remount: the trail
                     to the active section, hidden at the top level where it
                     would only repeat the heading below it. -->
                    <nav
                      v-if="crumbs.length > 1"
                      class="text-muted-foreground mb-5 flex flex-wrap items-center gap-1 text-xs"
                      data-testid="configurator-crumbs"
                    >
                      <template
                        v-for="(crumb, index) in crumbs"
                        :key="crumb.section.id"
                      >
                        <ChevronRight
                          v-if="index > 0"
                          class="size-3.5 shrink-0 opacity-60"
                        />
                        <button
                          type="button"
                          class="rounded px-1 py-0.5 transition-colors"
                          :class="
                            index === crumbs.length - 1
                              ? 'text-muted-foreground font-semibold'
                              : 'hover:text-foreground hover:underline'
                          "
                          data-testid="configurator-crumb"
                          :data-section-id="crumb.section.id"
                          @click="activeSectionId = crumb.section.id"
                        >
                          {{ crumb.section.name }}
                        </button>
                      </template>
                    </nav>

                    <!-- The key remounts the fields on a switch, as the prototype
                     does: a measurement typed but never blurred belongs to the
                     section it was typed in. -->
                    <div v-if="activeEntry" :key="activeEntry.section.id">
                      <header class="mb-6 flex items-center gap-3">
                        <span
                          class="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
                          data-testid="configurator-section-number"
                        >
                          {{ activeEntry.number }}
                        </span>
                        <!-- The prototype writes a description under the name; the
                         contract carries no section description, so no line is
                         written rather than an empty one. The text-box trim
                         centres the title optically against the number's circle. -->
                        <h4
                          class="font-heading min-w-0 text-2xl leading-none font-bold [text-box:trim-both_cap_alphabetic]"
                        >
                          {{ activeEntry.section.name }}
                        </h4>
                      </header>

                      <!-- Two or more children and the section renders none
                       of its own content: the first thing to do there is pick a
                       branch, and a form above the branches would bury them. -->
                      <ConfiguratorSection
                        v-if="!isMenu"
                        :section="activeEntry.section"
                        :disabled="busy"
                        @change="onChange"
                      />

                      <!-- The same list either way — as the landing of a
                       section that is only a way in, or under one that has a
                       child and nothing of its own to answer. `Next` would
                       reach the child, but a heading over an empty column
                       would not do. -->
                      <div
                        v-if="isMenu || listsChildrenInstead"
                        class="space-y-2"
                      >
                        <p class="text-muted-foreground mb-3 text-sm">
                          {{
                            isMenu
                              ? t('configurator.choose_subsection')
                              : t('configurator.subsections_only')
                          }}
                        </p>
                        <button
                          v-for="child in activeChildren"
                          :key="child.id"
                          type="button"
                          class="border-border hover:bg-accent/50 flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors"
                          data-testid="configurator-subsection"
                          :data-section-id="child.id"
                          @click="activeSectionId = child.id"
                        >
                          <span class="text-foreground text-sm font-medium">
                            {{ child.name }}
                          </span>
                          <ChevronRight
                            class="text-muted-foreground size-4 shrink-0"
                          />
                        </button>
                      </div>

                      <!-- Free movement, not a wizard: the rail jumps anywhere and
                       neither button asks whether the section was answered. -->
                      <div
                        class="border-border mt-6 flex items-center justify-between border-t pt-6"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          :disabled="!canStepBack"
                          data-testid="configurator-prev"
                          @click="step(-1)"
                        >
                          <ChevronLeft class="size-4" />
                          {{ t('configurator.previous') }}
                        </Button>
                        <span
                          class="text-muted-foreground text-xs tabular-nums"
                          data-testid="configurator-position"
                        >
                          {{
                            t('configurator.section_position', {
                              current: activeRailIndex + 1,
                              total: railEntries.length,
                            })
                          }}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          :disabled="!canStepForward"
                          data-testid="configurator-next"
                          @click="step(1)"
                        >
                          {{ t('configurator.next') }}
                          <ChevronRight class="size-4" />
                        </Button>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- top-48 is the measured header plus 1rem of air: the portal's
                 sticky header is 176px = 11rem at every width from 1024 up
                 (topbar, main row, nav), measured 2026-09-17. `items-start` on
                 the grid is what lets it stick. -->
            <aside
              v-if="stage !== 'committed'"
              class="lg:sticky lg:top-48 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto"
            >
              <!-- The card is the aside itself and every block inside pads
                   itself, so the specification fills the column rather than
                   sitting as a small box inside a larger one. The committed
                   summary carries the price it was committed at, so the card
                   stands down rather than show a second one. -->
              <Card class="divide-border gap-0 divide-y p-0">
                <ConfigurationPanel
                  :configuration="configuration"
                  :status="status"
                  :busy="busy"
                  :product-name="product.name ?? ''"
                  :article-number="product.articleNumber ?? ''"
                  @restart="onRestart"
                />

                <ConfigurationAction
                  v-if="stage === 'form'"
                  :can-commit="commitEnabled"
                  :busy="busy"
                  @commit="onCommit"
                />

                <ConfigurationSession
                  v-if="stage === 'form'"
                  :remaining-ms="remainingMs"
                  :busy="busy"
                  :error="forHeader"
                  @renew="onRenew"
                />
              </Card>
            </aside>
          </div>
        </TabsContent>

        <TabsContent
          v-if="hasDescription"
          value="description"
          data-print="description"
          force-mount
          class="bg-card mt-6 rounded-lg border p-6 data-[state=inactive]:hidden"
        >
          <ProductDescriptionPanel
            :text2="descriptionTexts.text2"
            :text3="descriptionTexts.text3"
          />
        </TabsContent>

        <TabsContent
          v-if="hasSpecs"
          value="specifications"
          data-print="specifications"
          force-mount
          class="bg-card mt-6 rounded-lg border p-6 data-[state=inactive]:hidden"
        >
          <ProductSpecificationsPanel :groups="visibleGroups" />
        </TabsContent>

        <TabsContent
          value="documents"
          data-print="documents"
          class="bg-card mt-6 rounded-lg border p-6"
        >
          <ProductDocumentsPanel />
        </TabsContent>

        <TabsContent
          v-if="hasRelated"
          value="related"
          data-print="related"
          class="bg-card mt-6 rounded-lg border p-6"
        >
          <ProductRelatedPanel :products="related ?? []" />
        </TabsContent>
      </Tabs>

      <!-- Print-only: extra product images in a 3-col grid. -->
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
            v-for="(img, index) in additionalImages"
            :key="img.fileName ?? ''"
            :file-name="img.fileName ?? ''"
            :alt="
              buildProductImageAlt({
                name: product.name ?? '',
                index,
                total: additionalImages.length,
                manualAlt: img.altText,
              })
            "
            type="product"
            loading="eager"
            fit="contain"
            aspect-ratio="1/1"
          />
        </div>
      </section>

      <!-- CMS zone, the same slot the ordinary product page renders. -->
      <CmsWidgetArea
        v-if="pdpCmsArea?.containers?.length"
        data-testid="pdp-cms-area"
        :containers="pdpCmsArea.containers"
      />
    </div>
  </div>
</template>
