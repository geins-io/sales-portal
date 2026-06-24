<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { productPath } from '#shared/utils/route-helpers';
import type { PortalItemRow, PortalItemTotal } from '#shared/types/portal-rows';

defineProps<{
  items: PortalItemRow[];
  totals: PortalItemTotal[];
  /** Label on the tappable trigger, e.g. "View order rows". */
  triggerLabel: string;
  /** Heading shown at the top of the sheet, e.g. "Order items". */
  title: string;
}>();

const { localePath } = useLocaleMarket();
const open = ref(false);
</script>

<template>
  <div>
    <!-- Tappable trigger that replaces the broken desktop table on mobile. -->
    <button
      type="button"
      data-testid="view-rows-trigger"
      class="border-border hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-5 py-4 text-left font-semibold transition-colors"
      @click="open = true"
    >
      <span>{{ triggerLabel }}</span>
      <ChevronRight class="text-muted-foreground size-5 shrink-0" />
    </button>

    <Sheet v-model:open="open">
      <SheetContent
        side="right"
        data-testid="item-rows-sheet"
        class="flex h-dvh w-[90%] flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader class="border-b px-6 py-4">
          <SheetTitle>{{ title }}</SheetTitle>
        </SheetHeader>

        <!-- Scrollable item list -->
        <div class="min-h-0 flex-1 overflow-y-auto px-6">
          <ul class="divide-border divide-y">
            <li
              v-for="item in items"
              :key="item.key"
              data-testid="item-rows-row"
              class="flex items-start gap-3 py-4"
            >
              <ProductThumbnail
                :file-name="item.imageFileName ?? null"
                :alt="item.name"
              />
              <div class="min-w-0 flex-1">
                <NuxtLink
                  v-if="item.alias"
                  :to="localePath(productPath(item.alias))"
                  class="font-medium hover:underline"
                >
                  {{ item.name }}
                </NuxtLink>
                <span v-else class="font-medium">{{ item.name }}</span>
                <p
                  v-if="item.articleNumber"
                  class="text-muted-foreground text-xs"
                >
                  {{ item.articleNumber }}
                </p>
                <p class="text-muted-foreground mt-1 text-sm">
                  {{ item.quantity }} &times; {{ item.unitPriceFormatted }}
                </p>
              </div>
              <div class="shrink-0 text-right text-sm font-medium">
                {{ item.totalPriceFormatted }}
              </div>
            </li>
          </ul>
        </div>

        <!-- Pinned totals footer -->
        <div class="shrink-0 border-t px-6 py-4">
          <div
            v-for="(row, index) in totals"
            :key="index"
            class="flex justify-between text-sm"
            :class="
              row.emphasis
                ? 'border-border mt-2 border-t pt-3 font-semibold'
                : 'py-1'
            "
          >
            <span :class="row.emphasis ? '' : 'text-muted-foreground'">{{
              row.label
            }}</span>
            <span>{{ row.value }}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
