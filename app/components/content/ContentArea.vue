<script setup lang="ts">
// ContentArea orchestrates the home page content sections
// Each section component manages its own static sample content
// TODO: Wire to CMS/tenant config for dynamic content
</script>

<template>
  <div class="flex flex-col">
    <!-- Hero Banner -->
    <ContentHero />

    <!-- 2-Column Feature Grid -->
    <ContentFeatureGrid
      section-title="CMS 2 col block"
      section-description="Add a concise value statement that highlights your product's key features and benefits in a visually dynamic grid."
      :columns="2"
    />

    <!-- 3-Column Feature Grid (no title) -->
    <ContentFeatureGrid :columns="3" :show-section-title="false" />

    <!-- Product List Carousel -->
    <ContentProductList title="Product list title" />

    <!-- 2-Column Feature Grid with Section Title (centered) -->
    <ContentFeatureGrid
      section-title="This is a section title"
      section-description="Add a concise value statement that highlights your product's key features and benefits in a visually dynamic grid."
      :columns="2"
      variant="overlay"
    />

    <!-- 4-Column Feature Grid with centered title -->
    <ContentFeatureGrid
      section-title="This is a section title"
      section-description="Add a concise value statement that highlights your product's key features and benefits in a visually dynamic grid."
      :columns="4"
    />

    <!-- Welcome Text Section -->
    <ContentTextSection />
  </div>
</template>
