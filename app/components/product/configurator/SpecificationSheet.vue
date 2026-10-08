<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';

/**
 * A whole specification, larger, from the right at the sign-in sheet's width:
 * the PDP's panel opens it, and so does a configured line, on top of the cart.
 * The footer slot holds the price, absent where the buyer may not see one.
 */
const { productName, testId } = defineProps<{
  productName: string;
  testId: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      :data-testid="testId"
    >
      <SheetHeader class="border-b px-6 py-4">
        <SheetTitle class="text-2xl font-semibold tracking-tight">
          {{ t('configurator.panel.title') }}
        </SheetTitle>
        <SheetDescription>{{ productName }}</SheetDescription>
      </SheetHeader>

      <div class="flex-1 overflow-y-auto">
        <slot />
      </div>

      <div v-if="$slots.footer" class="border-border border-t px-6 py-4">
        <slot name="footer" />
      </div>
    </SheetContent>
  </Sheet>
</template>
