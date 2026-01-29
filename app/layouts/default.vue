<script setup lang="ts"></script>

<template>
  <div class="bg-background flex min-h-screen flex-col">
    <LayoutHeader />
    <main class="flex-1">
      <slot />
    </main>
    <LayoutFooter />
  </div>
</template>
