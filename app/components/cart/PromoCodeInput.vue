<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

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
        <Button
          variant="ghost"
          class="hover:text-destructive size-auto p-0"
          data-testid="promo-remove"
          :disabled="loading"
          @click="emit('remove')"
        >
          <X class="size-3.5" />
        </Button>
      </span>
    </div>

    <!-- Input + Apply button -->
    <form v-else class="flex gap-2" @submit.prevent="onApply">
      <Input
        v-model="code"
        type="text"
        placeholder="Promo code"
        class="flex-1"
        data-testid="promo-input"
        :disabled="loading"
      />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        :disabled="loading || !code.trim()"
        data-testid="promo-apply"
      >
        Apply
      </Button>
    </form>
  </div>
</template>
