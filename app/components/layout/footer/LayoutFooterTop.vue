<script setup lang="ts"></script>

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
      <div class="flex w-full gap-2 lg:w-auto">
        <input
          type="email"
          :placeholder="$t('layout.enter_email')"
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:w-64"
        />
        <Button size="lg">
          {{ $t('layout.subscribe') }}
        </Button>
      </div>
    </div>
  </div>
</template>
