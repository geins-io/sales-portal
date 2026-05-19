<script setup lang="ts">
import BrandLogo from '@/components/shared/BrandLogo.vue';

defineProps<{
  productUrl: string;
}>();

const { t, locale } = useI18n();

// Render time has to be reactive against the actual print invocation —
// the `beforeprint` event is the only reliable hook for "user just hit
// print"; we stamp the timestamp then so it reflects the print moment,
// not page render. Falls back to mount time when client-only APIs
// aren't available (SSR).
const printedAt = ref('');

function formatNow(): string {
  const d = new Date();
  return d.toLocaleString(locale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  if (typeof window === 'undefined') return;
  printedAt.value = formatNow();
  const handler = () => {
    printedAt.value = formatNow();
  };
  window.addEventListener('beforeprint', handler);
  onBeforeUnmount(() => window.removeEventListener('beforeprint', handler));
});
</script>

<template>
  <header class="hidden" data-testid="pdp-print-header">
    <div class="flex items-center gap-5">
      <BrandLogo :linked="false" height="h-10" class="shrink-0" />
      <div class="flex flex-col gap-1 leading-tight">
        <p class="text-[11pt] text-black">
          <strong>{{ t('product.printed_on') }}:</strong> {{ printedAt }}
        </p>
        <p class="text-[10pt] break-all text-[#555]">{{ productUrl }}</p>
      </div>
    </div>
  </header>
</template>
