<script setup lang="ts">
// Nav bar variant — controls shadow + separator between main and nav.
// 'grey' (default): nav uses bg-muted, no header shadow, no border between
//   main and nav so it flows seamlessly into the grey nav.
// 'white': nav uses bg-background, header has shadow-sm and main has border-b
//   to visually separate the two same-colored sections.
type NavVariant = 'grey' | 'white';
const navVariant = ref<NavVariant>('grey');
</script>

<template>
  <header
    class="bg-background sticky top-0 z-50 w-full"
    :class="navVariant === 'white' ? 'shadow-sm' : ''"
  >
    <LayoutHeaderTopbar />
    <LayoutHeaderMain :nav-variant="navVariant" />
    <LayoutHeaderNav :variant="navVariant" />
  </header>
</template>
