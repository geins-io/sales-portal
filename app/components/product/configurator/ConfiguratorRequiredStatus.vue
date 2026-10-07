<script setup lang="ts">
import { CheckCircle2, ChevronDown, Info } from 'lucide-vue-next';
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
 *
 * What is left is folded on load behind a count. A change batch replaces the
 * document, not this component, so a list the buyer opened stays open while
 * they work through it.
 */
const { configuration } = defineProps<{ configuration: Configuration }>();

const emit = defineEmits<{ 'go-to': [item: BlockingItem] }>();

const { t } = useI18n();

const items = computed(() => collectBlockingItems(configuration));
const messages = computed(() => unnamedBlockingMessages(configuration));
const count = computed(() => items.value.length + messages.value.length);

const open = ref(false);
const listId = useId();
</script>

<template>
  <!-- From lg the page caps the column at the viewport; `min-h-0` lets this
       box take what the rail leaves, and only the open list scrolls. -->
  <div
    class="flex gap-2 rounded-md px-3 py-2 text-xs lg:min-h-0"
    :class="
      configuration.isValid
        ? 'bg-success/10 text-success items-center'
        : 'bg-warning/10 text-warning items-stretch'
    "
    data-testid="configurator-required-status"
  >
    <CheckCircle2 v-if="configuration.isValid" class="size-4 shrink-0" />
    <Info v-else class="size-4 shrink-0" />
    <span v-if="configuration.isValid">
      {{ t('configurator.required_status.all_done') }}
    </span>
    <div v-else class="flex min-h-0 min-w-0 flex-1 flex-col">
      <template v-if="count">
        <button
          type="button"
          class="flex w-full shrink-0 items-center justify-between gap-2 text-left"
          :aria-expanded="open"
          :aria-controls="listId"
          data-testid="configurator-required-toggle"
          @click="open = !open"
        >
          {{ t('configurator.required_status.remaining_count', { count }) }}
          <ChevronDown
            class="size-4 shrink-0 transition-transform"
            :class="open ? 'rotate-180' : ''"
          />
        </button>
        <div
          v-if="open"
          :id="listId"
          class="mt-1 max-h-[40vh] min-h-0 space-y-1 overflow-y-auto lg:max-h-none"
          data-testid="configurator-required-list"
        >
          <ul
            v-if="items.length"
            class="list-disc space-y-0.5 pl-4"
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
          <!-- A message no name stands for is a whole sentence of its own, so
               these are listed rather than folded into the list above. -->
          <ul
            v-if="messages.length"
            class="list-disc space-y-0.5 pl-4"
            data-testid="configurator-required-messages"
          >
            <li v-for="text in messages" :key="text">{{ text }}</li>
          </ul>
        </div>
      </template>
      <p v-else>
        {{ t('configurator.required_status.unspecified') }}
      </p>
    </div>
  </div>
</template>
