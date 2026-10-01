<script setup lang="ts">
import { CheckCircle2, Info } from 'lucide-vue-next';
import type { Configuration } from '#shared/types/configurator';
import {
  collectBlockingItems,
  unnamedBlockingMessages,
  type BlockingItem,
} from '~/utils/configurator-panel';

/**
 * Whether every required choice is made, and if not, what is left: one line
 * each, as a way there. Under the section rail, as the prototype; the page
 * opens the item's section and brings the node into view.
 */
const { configuration } = defineProps<{ configuration: Configuration }>();

const emit = defineEmits<{ 'go-to': [item: BlockingItem] }>();

const { t } = useI18n();

const items = computed(() => collectBlockingItems(configuration));
const messages = computed(() => unnamedBlockingMessages(configuration));
</script>

<template>
  <div
    class="flex gap-2 rounded-md px-3 py-2 text-xs"
    :class="
      configuration.isValid
        ? 'bg-success/10 text-success items-center'
        : 'bg-warning/10 text-warning items-start'
    "
    data-testid="configurator-required-status"
  >
    <CheckCircle2 v-if="configuration.isValid" class="size-4 shrink-0" />
    <Info v-else class="size-4 shrink-0" />
    <span v-if="configuration.isValid">
      {{ t('configurator.required_status.all_done') }}
    </span>
    <div v-else>
      <template v-if="items.length">
        <p>{{ t('configurator.required_status.remaining') }}</p>
        <ul
          class="mt-1 list-disc space-y-0.5 pl-4"
          data-testid="configurator-required-missing"
        >
          <li v-for="item in items" :key="item.name">
            <button
              type="button"
              class="text-left underline underline-offset-2 hover:no-underline"
              data-testid="configurator-required-missing-item"
              @click="emit('go-to', item)"
            >
              {{ item.name }}
            </button>
          </li>
        </ul>
      </template>
      <p v-else-if="!messages.length">
        {{ t('configurator.required_status.unspecified') }}
      </p>
      <!-- A message no name stands for is a whole sentence of its own, so
           these are listed rather than folded into the list above. -->
      <ul
        v-if="messages.length"
        class="mt-1 list-disc space-y-0.5 pl-4"
        data-testid="configurator-required-messages"
      >
        <li v-for="text in messages" :key="text">{{ text }}</li>
      </ul>
    </div>
  </div>
</template>
