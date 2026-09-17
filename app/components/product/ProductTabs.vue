<script setup lang="ts">
import type { DetailProduct, ListProduct } from '#shared/types/commerce';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {
  defaultProductTab,
  productDescriptionTexts,
  visibleParameterGroups,
} from '~/utils/product-tabs';

const props = defineProps<{
  product: DetailProduct;
  related?: ListProduct[] | null;
}>();

const descriptionTexts = computed(() => productDescriptionTexts(props.product));
const hasDescription = computed(
  () => !!(descriptionTexts.value.text2 || descriptionTexts.value.text3),
);
const visibleGroups = computed(() =>
  visibleParameterGroups(props.product.parameterGroups),
);
const hasSpecs = computed(() => visibleGroups.value.length > 0);
const hasRelated = computed(() => (props.related?.length ?? 0) > 0);

const defaultTab = computed(() =>
  defaultProductTab({
    hasDescription: hasDescription.value,
    hasSpecs: hasSpecs.value,
    hasRelated: hasRelated.value,
  }),
);

useProductTabPrint();
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
              v-if="descriptionTexts.text2"
              class="prose max-w-none"
              v-html="descriptionTexts.text2"
            />
            <div
              v-if="descriptionTexts.text3"
              class="prose max-w-none"
              v-html="descriptionTexts.text3"
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
