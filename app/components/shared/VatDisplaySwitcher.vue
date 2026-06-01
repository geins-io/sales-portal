<script setup lang="ts">
import { Receipt } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    /** Display variant: icon-only button, text+icon button, or inline button row */
    variant?: 'icon' | 'text' | 'inline';
  }>(),
  { variant: 'icon' },
);

const { showIncVat, setShowIncVat } = useVatDisplay();
const { t } = useI18n();
</script>

<template>
  <!-- Inline: flat button row -->
  <div v-if="props.variant === 'inline'" class="flex gap-1">
    <Button
      :variant="showIncVat ? 'secondary' : 'ghost'"
      size="sm"
      @click="setShowIncVat(true)"
    >
      {{ t('common.vat_incl') }}
    </Button>
    <Button
      :variant="!showIncVat ? 'secondary' : 'ghost'"
      size="sm"
      @click="setShowIncVat(false)"
    >
      {{ t('common.vat_excl') }}
    </Button>
  </div>

  <!-- Dropdown: icon-only or text+icon trigger -->
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button
        v-if="props.variant === 'text'"
        variant="ghost"
        size="sm"
        :aria-label="t('common.change_vat_display')"
      >
        <Receipt class="mr-2 h-4 w-4" />
        {{ showIncVat ? t('common.vat_incl') : t('common.vat_excl') }}
      </Button>
      <Button
        v-else
        variant="ghost"
        size="icon"
        :aria-label="t('common.change_vat_display')"
      >
        <Receipt class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>{{ t('common.vat_display') }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        :class="{ 'font-semibold': showIncVat }"
        @click="setShowIncVat(true)"
      >
        {{ t('common.vat_incl') }}
      </DropdownMenuItem>
      <DropdownMenuItem
        :class="{ 'font-semibold': !showIncVat }"
        @click="setShowIncVat(false)"
      >
        {{ t('common.vat_excl') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
