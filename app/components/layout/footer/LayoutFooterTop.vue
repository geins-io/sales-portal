<script setup lang="ts">
import { Button } from '@/components/ui/button';

const email = ref('');

function handleSubscribe() {
  // TODO: Wire to newsletter API
  console.log('Subscribe:', email.value);
  email.value = '';
}
</script>

<template>
  <div class="flex w-full items-center justify-between">
    <!-- Left: Newsletter text -->
    <div class="flex flex-col gap-1">
      <p class="text-foreground text-lg font-medium">
        Subscribe to our newsletter
      </p>
      <p class="text-muted-foreground text-sm">
        Get the latest news and updates from our team.
      </p>
    </div>

    <!-- Right: Email form -->
    <form
      class="flex max-w-[384px] flex-1 items-start gap-2"
      @submit.prevent="handleSubscribe"
    >
      <input
        v-model="email"
        type="email"
        placeholder="Enter your email"
        class="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-9 flex-1 rounded-md border px-3 py-1 text-sm shadow-sm focus:ring-1 focus:outline-none"
      />
      <Button type="submit" size="sm">Subscribe</Button>
    </form>
  </div>
</template>
