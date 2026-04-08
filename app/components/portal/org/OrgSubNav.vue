<script setup lang="ts">
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [tab: string];
}>();

interface SubTab {
  key: string;
  label: string;
}

const tabs: SubTab[] = [
  { key: 'info', label: 'portal.org.tabs.info' },
  { key: 'persons', label: 'portal.org.tabs.persons' },
  { key: 'addresses', label: 'portal.org.tabs.addresses' },
  { key: 'roles', label: 'portal.org.tabs.roles' },
];
</script>

<template>
  <nav data-testid="org-sub-nav" :aria-label="t('nav.sidebar_navigation')">
    <!-- Desktop: vertical sidebar -->
    <ul class="hidden flex-col space-y-1 md:flex">
      <li v-for="tab in tabs" :key="tab.key">
        <Button
          :variant="props.modelValue === tab.key ? 'secondary' : 'ghost'"
          class="w-full justify-start ps-3"
          :class="
            props.modelValue === tab.key
              ? 'font-medium'
              : 'text-muted-foreground'
          "
          :data-testid="`org-tab-${tab.key}`"
          @click="emit('update:modelValue', tab.key)"
        >
          {{ t(tab.label) }}
        </Button>
      </li>
    </ul>

    <!-- Mobile: horizontal scroll -->
    <div class="flex gap-1 overflow-x-auto md:hidden">
      <Button
        v-for="tab in tabs"
        :key="tab.key"
        :variant="props.modelValue === tab.key ? 'secondary' : 'ghost'"
        size="sm"
        class="whitespace-nowrap"
        :class="props.modelValue !== tab.key ? 'text-muted-foreground' : ''"
        :data-testid="`org-tab-${tab.key}`"
        @click="emit('update:modelValue', tab.key)"
      >
        {{ t(tab.label) }}
      </Button>
    </div>
  </nav>
</template>
