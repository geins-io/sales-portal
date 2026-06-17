<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { adminText } from '~/utils/product-texts';

const props = defineProps<{
  product: DetailProduct;
  related?: ListProduct[] | null;
}>();

// True when the HTML carries visible copy, not just empty editor markup
// (e.g. `<p><br></p>`), so a blank field never shows an empty block.
function hasRenderableHtml(html: string | undefined): html is string {
  return !!html && html.replace(/<[^>]*>/g, '').trim().length > 0;
}

// The details tab shows the merchant's admin "Text 2" copy first, then
// "Text 3", each capped at max-w-3xl. `adminText` maps the PIM box numbers
// onto the offset Merchant API fields (see ~/utils/product-texts).
const detailsText2 = computed(() => {
  const html = adminText(props.product.texts, 2);
  return hasRenderableHtml(html) ? html : undefined;
});
const detailsText3 = computed(() => {
  const html = adminText(props.product.texts, 3);
  return hasRenderableHtml(html) ? html : undefined;
});
const hasDescription = computed(
  () => !!(detailsText2.value || detailsText3.value),
);
const HIDDEN_PARAMETER_GROUPS = /^monitor$/i;
const visibleGroups = computed(() =>
  (props.product.parameterGroups ?? [])
    .filter((g) => !HIDDEN_PARAMETER_GROUPS.test(g.name ?? ''))
    .map((g) => ({
      ...g,
      // `show` is the merchant's storefront-visibility toggle in Geins.
      // Parameters flagged off (e.g. internal ERP-imported fields) are not
      // meant for the product page, so they never render here.
      parameters: (g.parameters ?? []).filter(
        (p) => p.show && (p.name || p.label) && p.value != null,
      ),
    }))
    .filter((g) => g.parameters.length > 0),
);
const hasSpecs = computed(() => visibleGroups.value.length > 0);
const hasRelated = computed(() => (props.related?.length ?? 0) > 0);

const defaultTab = computed(() => {
  if (hasDescription.value) return 'description';
  if (hasSpecs.value) return 'specifications';
  if (hasRelated.value) return 'related';
  return 'documents';
});

// Print expansion: radix Tabs sets the `hidden` HTML attribute on
// inactive panels. The `[hidden]` reset lives in Tailwind's @layer base
// with !important, and unlayered overrides cannot beat that because
// CSS cascade-layers reverses layer order for !important. The simplest
// reliable answer is to drop the attribute on `beforeprint` for the
// panels we want printed, and put it back on `afterprint`.
onMounted(() => {
  if (typeof window === 'undefined') return;
  const PRINT_VISIBLE = ['description', 'specifications'];
  const restoredHidden: HTMLElement[] = [];
  const onBeforePrint = () => {
    document
      .querySelectorAll<HTMLElement>(
        '[data-testid="product-tabs"] [data-print]',
      )
      .forEach((el) => {
        const key = el.getAttribute('data-print');
        if (key && PRINT_VISIBLE.includes(key) && el.hasAttribute('hidden')) {
          el.removeAttribute('hidden');
          restoredHidden.push(el);
        }
      });
  };
  const onAfterPrint = () => {
    while (restoredHidden.length) {
      const el = restoredHidden.pop()!;
      el.setAttribute('hidden', '');
    }
  };
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);
  onBeforeUnmount(() => {
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
  });
});
</script>

<template>
  <div data-testid="product-tabs">
    <!-- Desktop: Tabs (hidden below md via CSS to avoid SSR/client flash) -->
    <Tabs class="hidden md:block" :default-value="defaultTab">
      <TabsList variant="underline">
        <TabsTrigger v-if="hasDescription" value="description">
          {{ $t('product.details') }}
        </TabsTrigger>
        <TabsTrigger v-if="hasSpecs" value="specifications">
          {{ $t('product.specifications') }}
        </TabsTrigger>
        <TabsTrigger value="documents">
          {{ $t('product.documents') }}
        </TabsTrigger>
        <TabsTrigger v-if="hasRelated" value="related">
          {{ $t('product.related') }}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-if="hasDescription"
        value="description"
        data-print="description"
        force-mount
        class="bg-card mt-6 rounded-lg border p-6 data-[state=inactive]:hidden"
      >
        <h3 class="font-heading mb-4 text-2xl font-bold">
          {{ $t('product.details') }}
        </h3>
        <!-- eslint-disable vue/no-v-html -->
        <div class="max-w-3xl space-y-6">
          <div
            v-if="detailsText2"
            class="prose max-w-none"
            v-html="detailsText2"
          />
          <div
            v-if="detailsText3"
            class="prose max-w-none"
            v-html="detailsText3"
          />
        </div>
        <!-- eslint-enable vue/no-v-html -->
      </TabsContent>

      <TabsContent
        v-if="hasSpecs"
        value="specifications"
        data-print="specifications"
        force-mount
        class="bg-card mt-6 rounded-lg border p-6 data-[state=inactive]:hidden"
      >
        <h3 class="font-heading mb-6 text-2xl font-bold">
          {{ $t('product.specifications') }}
        </h3>
        <div class="grid gap-8 md:grid-cols-2">
          <div
            v-for="group in visibleGroups"
            :key="group.name ?? group.parameterGroupId"
            class="flex flex-col gap-3"
          >
            <h4
              data-testid="spec-group-title"
              class="font-heading text-xl font-semibold"
            >
              {{ group.name }}
            </h4>
            <p
              v-if="group.parameters?.[0]?.description"
              class="text-muted-foreground text-sm"
            >
              {{ group.parameters[0].description }}
            </p>
            <table class="w-full text-sm" data-testid="spec-table">
              <tbody>
                <tr
                  v-for="(param, idx) in group.parameters"
                  :key="param.identifier ?? param.name ?? idx"
                  class="border-border odd:bg-muted/40 border-b"
                >
                  <td class="text-muted-foreground px-3 py-3 pr-4">
                    {{ param.name ?? param.label ?? '' }}
                  </td>
                  <td class="px-3 py-3 text-right">{{ param.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="documents"
        data-print="documents"
        class="bg-card mt-6 rounded-lg border p-6"
      >
        <h3 class="font-heading mb-4 text-2xl font-bold">
          {{ $t('product.documents') }}
        </h3>
        <p class="text-muted-foreground text-sm">
          {{ $t('product.no_documents') }}
        </p>
      </TabsContent>

      <TabsContent
        v-if="hasRelated"
        value="related"
        data-print="related"
        class="bg-card mt-6 rounded-lg border p-6"
      >
        <h3 class="font-heading mb-4 text-2xl font-bold">
          {{ $t('product.related') }}
        </h3>
        <RelatedProducts :products="related ?? []" :hide-heading="true" />
      </TabsContent>
    </Tabs>

    <!-- Mobile: Accordion (hidden at md+ via CSS to avoid SSR/client flash).
         Print uses the desktop tabs branch (md+ media query active in the
         print preview), so this accordion stays hidden when printing. -->
    <Accordion class="md:hidden print:hidden" type="multiple">
      <AccordionItem v-if="hasDescription" value="description">
        <AccordionTrigger>{{ $t('product.details') }}</AccordionTrigger>
        <AccordionContent>
          <!-- eslint-disable vue/no-v-html -->
          <div class="max-w-3xl space-y-6">
            <div
              v-if="detailsText2"
              class="prose max-w-none"
              v-html="detailsText2"
            />
            <div
              v-if="detailsText3"
              class="prose max-w-none"
              v-html="detailsText3"
            />
          </div>
          <!-- eslint-enable vue/no-v-html -->
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="hasSpecs" value="specifications">
        <AccordionTrigger>{{ $t('product.specifications') }}</AccordionTrigger>
        <AccordionContent>
          <div class="flex flex-col gap-4">
            <div
              v-for="group in visibleGroups"
              :key="group.name ?? group.parameterGroupId"
              class="flex flex-col gap-2"
            >
              <h4 class="text-sm font-semibold">{{ group.name }}</h4>
              <table class="w-full text-sm" data-testid="spec-table">
                <tbody>
                  <tr
                    v-for="(param, idx) in group.parameters"
                    :key="param.identifier ?? param.name ?? idx"
                    class="border-border border-b"
                  >
                    <td class="text-muted-foreground py-2 pr-4">
                      {{ param.name ?? param.label ?? '' }}
                    </td>
                    <td class="py-2">{{ param.value }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="documents">
        <AccordionTrigger>{{ $t('product.documents') }}</AccordionTrigger>
        <AccordionContent>
          <p class="text-muted-foreground text-sm">
            {{ $t('product.no_documents') }}
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem v-if="hasRelated" value="related">
        <AccordionTrigger>{{ $t('product.related') }}</AccordionTrigger>
        <AccordionContent>
          <RelatedProducts :products="related ?? []" :hide-heading="true" />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>
