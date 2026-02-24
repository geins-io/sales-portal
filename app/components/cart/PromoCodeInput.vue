<script setup lang="ts">
import { X } from 'lucide-vue-next';

defineProps<{
  activeCode: string | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  apply: [code: string];
  remove: [];
}>();

const code = ref('');

function onApply() {
  const trimmed = code.value.trim();
  if (!trimmed) return;
  emit('apply', trimmed);
  code.value = '';
}
</script>

<template>
  <div data-testid="promo-code-input">
    <!-- Active promo code badge -->
    <div v-if="activeCode" class="flex items-center gap-2">
      <span
        class="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
      >
        {{ activeCode }}
        <button
          type="button"
          class="hover:text-destructive transition-colors"
          data-testid="promo-remove"
          :disabled="loading"
          @click="emit('remove')"
        >
          <X class="size-3.5" />
        </button>
      </span>
    </div>

    <!-- Input + Apply button -->
    <form v-else class="flex gap-2" @submit.prevent="onApply">
      <input
        v-model="code"
        type="text"
        placeholder="Promo code"
        class="border-input bg-background placeholder:text-muted-foreground flex-1 rounded-md border px-3 py-1.5 text-sm"
        data-testid="promo-input"
        :disabled="loading"
      />
      <button
        type="submit"
        class="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        :disabled="loading || !code.trim()"
        data-testid="promo-apply"
      >
        Apply
      </button>
    </form>
  </div>
</template>
