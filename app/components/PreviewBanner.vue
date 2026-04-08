<script setup lang="ts">
import { Pencil, EyeOff } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';

const { t } = useI18n();
const { isPreview, exitPreview } = useCmsPreview();
const studioConnected = useState('cms-studio-connected', () => false);
</script>

<template>
  <div
    v-if="isPreview"
    class="sticky top-0 z-[61] flex min-h-12 items-center gap-4 bg-orange-700 px-5 shadow-[0_2px_8px_rgba(0,0,0,.25)]"
  >
    <Pencil class="size-[13px] shrink-0 text-orange-200" />
    <span class="text-[11px] font-bold tracking-[0.08em] text-white uppercase">
      {{ t('preview.title') }}
    </span>
    <span class="text-[11px] text-orange-200">
      {{ t('preview.description') }}
    </span>

    <span class="flex-1" />

    <span
      v-if="studioConnected"
      class="size-2 shrink-0 rounded-full bg-green-500"
      :title="t('preview.studio_connected')"
    />

    <Button
      variant="ghost"
      size="sm"
      class="gap-1.5 bg-black/20 text-[11px] font-medium text-white hover:bg-black/[.35] hover:text-white"
      @click="exitPreview"
    >
      <EyeOff class="size-[13px]" />
      {{ t('preview.exit') }}
    </Button>
  </div>
</template>
