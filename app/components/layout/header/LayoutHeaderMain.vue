<script setup lang="ts">
interface Props {
  variant?: 'default' | 'logged-in' | 'logged-in-light'
  searchPlaceholder?: string
}


</script>

<template>
  <div>
    <Logo />
    <SearchBar />
    <LayoutHeaderActionButtons />
  </div>
</template>
