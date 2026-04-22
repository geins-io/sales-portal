<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();

const isDismissed = ref(false);

const isVisible = computed(
  () => !isDismissed.value && route.query.applied === '1',
);

function dismiss() {
  isDismissed.value = true;
}
</script>

<template>
  <div
    v-if="isVisible"
    data-testid="portal-pending-approval-banner"
    class="border-border bg-muted text-foreground flex items-start gap-3 rounded-md border p-4"
    role="status"
  >
    <Icon name="lucide:info" class="mt-0.5 size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <p class="font-semibold">
        {{ t('apply.pending_approval_title') }}
      </p>
      <p class="text-muted-foreground mt-1 text-sm">
        {{ t('apply.pending_approval_body') }}
      </p>
    </div>
    <button
      type="button"
      data-testid="portal-pending-approval-dismiss"
      :aria-label="t('apply.dismiss_banner')"
      class="text-muted-foreground hover:text-foreground shrink-0"
      @click="dismiss"
    >
      <Icon name="lucide:x" class="size-4" />
    </button>
  </div>
</template>
