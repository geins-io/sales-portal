<script setup lang="ts">
const { t } = useI18n();

const props = defineProps<{
  activeTab: string;
}>();

const emit = defineEmits<{
  'update:tab': [tab: string];
}>();

interface SubTab {
  key: string;
  label: string;
  icon: string;
}

const tabs: SubTab[] = [
  { key: 'info', label: 'portal.org.tabs.info', icon: 'lucide:building-2' },
  {
    key: 'addresses',
    label: 'portal.org.tabs.addresses',
    icon: 'lucide:map-pin',
  },
  { key: 'buyers', label: 'portal.org.tabs.buyers', icon: 'lucide:users' },
];
</script>

<template>
  <nav
    data-testid="org-sub-nav"
    class="border-border mb-6 flex gap-1 overflow-x-auto border-b"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
      :class="
        props.activeTab === tab.key
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'
      "
      :data-testid="`org-tab-${tab.key}`"
      @click="emit('update:tab', tab.key)"
    >
      <Icon :name="tab.icon" class="size-4" />
      {{ t(tab.label) }}
    </button>
  </nav>
</template>
