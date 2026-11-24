<template>
  <div data-slot="footer-bottom" class="content-column">
    <!-- The rule separates the copyright from the rows above; with none, no rule. -->
    <div
      class="border-footer-text flex flex-col items-center gap-4 border-t py-10 [:first-child>&]:border-t-0"
    >
      <div class="flex w-full justify-between">
        <Copyright />
      </div>

      <PoweredBy />
    </div>
  </div>
</template>
