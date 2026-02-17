<script setup lang="ts">
const email = ref('');
const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle');

async function handleSubscribe() {
  if (!email.value) return;

  status.value = 'loading';
  try {
    await $fetch('/api/newsletter/subscribe', {
      method: 'POST',
      body: { email: email.value },
    });
    status.value = 'success';
    email.value = '';
  } catch {
    status.value = 'error';
  }
}
</script>

<template>
  <div data-slot="footer-top" class="border-b px-6 py-8 lg:px-8 lg:py-10">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
    >
      <!-- Text -->
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">
          {{ $t('layout.subscribe_heading') }}
        </h2>
        <p class="text-muted-foreground text-sm">
          {{ $t('layout.subscribe_description') }}
        </p>
      </div>

      <!-- Form -->
      <form
        class="flex w-full flex-col gap-2 lg:w-auto"
        @submit.prevent="handleSubscribe"
      >
        <div class="flex gap-2">
          <input
            v-model="email"
            type="email"
            required
            :disabled="status === 'loading'"
            :placeholder="$t('layout.enter_email')"
            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 lg:w-64"
          />
          <Button size="lg" type="submit" :disabled="status === 'loading'">
            {{ $t('layout.subscribe') }}
          </Button>
        </div>
        <p v-if="status === 'success'" class="text-sm text-green-600">
          {{ $t('layout.subscribe_success') }}
        </p>
        <p v-if="status === 'error'" class="text-destructive text-sm">
          {{ $t('layout.subscribe_error') }}
        </p>
      </form>
    </div>
  </div>
</template>
