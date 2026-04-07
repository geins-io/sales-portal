<script setup lang="ts">
import { User } from 'lucide-vue-next';

const { t } = useI18n();
const { isImpersonating, spoofedBy, customerName, exitImpersonation } =
  useImpersonation();
</script>

<template>
  <div
    v-if="isImpersonating"
    class="sticky top-0 z-[60] flex min-h-12 items-center gap-4 bg-blue-800 px-5 shadow-[0_2px_8px_rgba(0,0,0,.25)]"
  >
    <User class="size-[13px] shrink-0 text-blue-300" />
    <span class="text-[11px] font-bold tracking-[0.08em] text-white uppercase">
      {{ t('impersonation.title') }}
    </span>
    <span class="text-[11px] text-blue-300">
      {{
        t('impersonation.description', {
          customerName: customerName,
          adminEmail: spoofedBy,
        })
      }}
    </span>

    <span class="flex-1" />

    <button
      class="flex items-center gap-1.5 rounded-md bg-black/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-black/[.35]"
      @click="exitImpersonation"
    >
      {{ t('impersonation.exit') }}
    </button>
  </div>
</template>
