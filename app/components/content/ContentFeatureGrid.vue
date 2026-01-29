<script setup lang="ts">
interface FeatureCard {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
}

interface Props {
  sectionTitle?: string;
  sectionDescription?: string;
  columns?: 2 | 3 | 4;
  cards?: FeatureCard[];
  showSectionTitle?: boolean;
  variant?: 'default' | 'overlay';
}

// TODO: Wire to CMS/tenant config
const defaultCards: FeatureCard[] = [
  {
    title: 'Feature title',
    description:
      'Shortly describe how this feature solves a specific user problem.',
    ctaLabel: 'Button',
    ctaHref: '#',
  },
  {
    title: 'Feature title',
    description:
      'Shortly describe how this feature solves a specific user problem.',
    ctaLabel: 'Button',
    ctaHref: '#',
  },
  {
    title: 'Feature title',
    description:
      'Shortly describe how this feature solves a specific user problem.',
    ctaLabel: 'Button',
    ctaHref: '#',
  },
];

const props = withDefaults(defineProps<Props>(), {
  sectionTitle: 'CMS block',
  sectionDescription:
    "Add a concise value statement that highlights your product's key features and benefits in a visually dynamic grid.",
  columns: 3,
  cards: () => [],
  showSectionTitle: true,
  variant: 'default',
});

const displayCards = computed(() =>
  props.cards.length > 0 ? props.cards : defaultCards.slice(0, props.columns),
);

const gridClasses = computed(() => {
  const colMap = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };
  return colMap[props.columns];
});
</script>

<template>
  <section class="w-full py-10 md:py-16">
    <div class="mx-auto flex w-full max-w-[1280px] flex-col gap-12 px-6">
      <!-- Section header -->
      <div v-if="showSectionTitle" class="flex flex-col gap-2">
        <h2
          class="font-heading text-foreground text-2xl font-bold tracking-tight"
        >
          {{ sectionTitle }}
        </h2>
        <p class="text-muted-foreground text-base leading-6">
          {{ sectionDescription }}
        </p>
      </div>

      <!-- Grid -->
      <div class="grid gap-4" :class="gridClasses">
        <ContentFeatureCard
          v-for="(card, index) in displayCards"
          :key="index"
          :title="card.title"
          :description="card.description"
          :cta-label="card.ctaLabel"
          :cta-href="card.ctaHref"
          :image-url="card.imageUrl"
          :variant="variant"
        />
      </div>
    </div>
  </section>
</template>
