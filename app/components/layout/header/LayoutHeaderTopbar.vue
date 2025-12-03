<script setup lang="ts">
import { FileText, List, User } from 'lucide-vue-next';
import type { HeaderAuthState } from '@/shared/types';

interface Props {
  authState?: HeaderAuthState;
}

const props = withDefaults(defineProps<Props>(), {
  authState: 'logged-out' as HeaderAuthState,
});
</script>

<template>
  <div
    class="bg-primary text-primary-foreground flex h-10 items-center justify-between px-3 text-xs sm:px-4 sm:text-sm">
    <!-- Left: contact + language -->
    <div class="flex items-center gap-3">
      <Button type="button"
        class="text-primary-foreground/80 hover:text-primary-foreground inline-flex items-center gap-1.5 text-[0.8125rem] font-medium sm:text-[0.875rem]">
        <span>Contact us</span>
      </Button>

      <span class="text-primary-foreground/70 inline-flex items-center text-[0.8125rem] sm:text-[0.875rem]">
        Swedish
      </span>
    </div>

    <!-- Right: quotes, lists, account/login -->
    <nav class="flex items-center gap-4">
      <Button type="button"
        class="text-primary-foreground/80 hover:text-primary-foreground inline-flex items-center gap-1.5 text-[0.8125rem] font-medium sm:text-[0.875rem]">
        <FileText class="h-4 w-4" aria-hidden="true" />
        <span>Quotes</span>
      </Button>

      <Button type="button"
        class="text-primary-foreground/80 hover:text-primary-foreground inline-flex items-center gap-1.5 text-[0.8125rem] font-medium sm:text-[0.875rem]">
        <List class="h-4 w-4" aria-hidden="true" />
        <span>Quotes</span>
      </Button>

      <Button type="button"
        class="text-primary-foreground/80 hover:text-primary-foreground inline-flex items-center gap-1.5 text-[0.8125rem] font-medium sm:text-[0.875rem]">
        <User class="h-4 w-4" aria-hidden="true" />
        <span>
          {{ props.authState === 'logged-in' ? 'Your account' : 'Log in' }}
        </span>
      </Button>
    </nav>
  </div>
</template>
