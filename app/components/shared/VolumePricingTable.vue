<script setup lang="ts">
import type { CampaignPriceType } from '@geins/types';

const props = withDefaults(
  defineProps<{
    prices: CampaignPriceType[];
    showVat?: boolean;
  }>(),
  {
    showVat: true,
  },
);

function formatTierPrice(tier: CampaignPriceType): string {
  if (props.showVat) {
    return tier.price?.sellingPriceIncVatFormatted ?? '';
  }
  return tier.price?.sellingPriceExVatFormatted ?? '';
}
</script>

<template>
  <div v-if="prices.length > 1" class="space-y-2">
    <h4 class="text-sm font-medium">{{ $t('discount.volume_pricing') }}</h4>
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-left">
          <th class="py-1.5 font-medium">{{ $t('discount.quantity') }}</th>
          <th class="py-1.5 font-medium">{{ $t('discount.unit_price') }}</th>
          <th class="py-1.5 font-medium">{{ $t('discount.savings') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="tier in prices"
          :key="tier.quantity"
          class="border-b last:border-0"
        >
          <td class="py-1.5">{{ tier.quantity }}+</td>
          <td class="py-1.5">{{ formatTierPrice(tier) }}</td>
          <td class="text-destructive py-1.5 font-medium">
            -{{ tier.discountPercentage }}%
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
