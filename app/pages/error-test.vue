<script setup>
function triggerClientError() {
  throw new Error('Nuxt Button Error');
}
</script>
<template>
  <Button id="errorBtn" @click="triggerClientError">
    Throw Client Error
  </Button>
</template>
