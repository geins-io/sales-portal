<script setup lang="ts">
import { Button } from '~/components/ui/button';

const { hasInteracted, accept, revoke } = useAnalyticsConsent();
const { hasFeature } = useTenant();

const visible = computed(() => !hasInteracted.value && hasFeature('analytics'));
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <div
        v-if="visible"
        role="dialog"
        aria-label="Cookie consent"
        class="bg-card text-card-foreground fixed inset-x-0 bottom-0 z-50 rounded-t shadow-lg"
      >
        <div
          class="mx-auto flex max-w-screen-lg flex-col items-center gap-4 px-6 py-4 sm:flex-row sm:justify-between"
        >
          <p class="text-sm">
            {{ $t('cookies.banner_text') }}
          </p>
          <div class="flex shrink-0 gap-2">
            <Button @click="accept">
              {{ $t('cookies.accept') }}
            </Button>
            <Button variant="secondary" @click="revoke">
              {{ $t('cookies.decline') }}
            </Button>
          </div>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>
