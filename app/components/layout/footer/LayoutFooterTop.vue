<script setup lang="ts">
import { Input } from '~/components/ui/input';

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
  <div data-slot="footer-top" class="px-6 pt-10 pb-2.5 lg:px-6">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">
          {{ $t('layout.subscribe_heading') }}
        </h2>
        <p class="text-footer-text/70 text-sm">
          {{ $t('layout.subscribe_description') }}
        </p>
      </div>

      <form
        class="flex w-full flex-col gap-2 lg:w-auto"
        @submit.prevent="handleSubscribe"
      >
        <div class="flex gap-2">
          <Input
            v-model="email"
            type="email"
            required
            :disabled="status === 'loading'"
            :placeholder="$t('layout.enter_email')"
            class="text-foreground w-full border-[#D1D1D1] bg-white lg:w-64"
          />
          <Button
            size="lg"
            type="submit"
            variant="outline"
            :disabled="status === 'loading'"
            class="text-footer-text hover:bg-footer-text/10 border-[#D1D1D1] bg-transparent"
          >
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
