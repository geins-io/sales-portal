<script setup lang="ts">
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
        <button
          type="button"
          class="block w-full rounded-md py-2 ps-3 text-left text-sm transition-colors"
          :class="
            props.modelValue === tab.key
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          "
          :data-testid="`org-tab-${tab.key}`"
          @click="emit('update:modelValue', tab.key)"
        >
          {{ t(tab.label) }}
        </button>
      </li>
    </ul>

    <!-- Mobile: horizontal scroll -->
    <div class="flex gap-1 overflow-x-auto md:hidden">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
        :class="
          props.modelValue === tab.key
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        "
        :data-testid="`org-tab-${tab.key}`"
        @click="emit('update:modelValue', tab.key)"
      >
        {{ t(tab.label) }}
      </button>
    </div>
  </nav>
</template>
