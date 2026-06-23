<script setup lang="ts">
// Header nav variant — controls shadow + separator between main and nav.
//   'grey' : nav is bg-muted; header has no shadow and main has no border-b,
//            so it flows seamlessly into the grey nav.
//   'white': nav is bg-background; header gets shadow-sm and main gets border-b
//            to visually separate two same-coloured sections.
//
// Resolution: tenant.layout.headerNavVariant → 'grey' (default).
const { tenant } = useTenant();
const navVariant = computed<'grey' | 'white'>(
  () => tenant.value?.layout?.headerNavVariant ?? 'grey',
);
</script>

<template>
  <header
    class="bg-background sticky top-0 z-50 w-full"
    :class="navVariant === 'white' ? 'shadow-sm' : ''"
  >
    <LayoutHeaderTopbar />
    <LayoutHeaderMain :nav-variant="navVariant" />
    <LayoutHeaderNav :variant="navVariant" />
    <LayoutHeaderMobileSearch />
  </header>
</template>
