<script setup lang="ts">
import type { Buyer, BuyerRole } from '#shared/types/b2b';
import { DEFAULT_ROLES } from '#shared/types/b2b';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

const { t } = useI18n();

const emit = defineEmits<{
  invited: [buyer: Buyer];
  cancel: [];
}>();

const isLoading = ref(false);
const errorMessage = ref('');

const formData = reactive({
  email: '',
  firstName: '',
  lastName: '',
  role: 'order_placer' as BuyerRole,
});

const roleOptions = Object.values(DEFAULT_ROLES);

const isValid = computed(
  () =>
    formData.email.trim() !== '' &&
    formData.firstName.trim() !== '' &&
    formData.lastName.trim() !== '',
);

async function handleSubmit() {
  if (!isValid.value) return;

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const result = await $fetch<{ buyer: Buyer }>('/api/organization/buyers', {
      method: 'POST',
      body: { ...formData },
    });
    emit('invited', result.buyer);
  } catch {
    errorMessage.value = t('portal.org.buyers.invite_error');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div
    data-testid="buyer-invite-form"
    class="border-border rounded-lg border p-6"
  >
    <h3 class="mb-4 text-lg font-semibold">
      {{ t('portal.org.buyers.invite_title') }}
    </h3>

    <div
      v-if="errorMessage"
      data-testid="buyer-invite-error"
      class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm"
    >
      {{ errorMessage }}
    </div>

    <form
      data-testid="buyer-invite-submit-form"
      class="space-y-4"
      @submit.prevent="handleSubmit"
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="buyer-firstName">
            {{ t('portal.org.buyers.first_name') }}
          </Label>
          <Input
            id="buyer-firstName"
            v-model="formData.firstName"
            type="text"
            :disabled="isLoading"
            data-testid="buyer-input-firstName"
          />
        </div>
        <div class="space-y-2">
          <Label for="buyer-lastName">
            {{ t('portal.org.buyers.last_name') }}
          </Label>
          <Input
            id="buyer-lastName"
            v-model="formData.lastName"
            type="text"
            :disabled="isLoading"
            data-testid="buyer-input-lastName"
          />
        </div>
      </div>

      <div class="space-y-2">
        <Label for="buyer-email">
          {{ t('portal.org.buyers.email') }}
        </Label>
        <Input
          id="buyer-email"
          v-model="formData.email"
          type="email"
          :disabled="isLoading"
          data-testid="buyer-input-email"
        />
      </div>

      <div class="space-y-2">
        <Label for="buyer-role">
          {{ t('portal.org.buyers.role') }}
        </Label>
        <Select
          :model-value="formData.role"
          :disabled="isLoading"
          @update:model-value="formData.role = $event as BuyerRole"
        >
          <SelectTrigger data-testid="buyer-input-role">
            <SelectValue :placeholder="DEFAULT_ROLES[formData.role].label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in roleOptions"
              :key="opt.role"
              :value="opt.role"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex gap-2">
        <Button
          type="submit"
          :disabled="isLoading || !isValid"
          data-testid="buyer-invite-submit"
        >
          {{
            isLoading
              ? t('portal.org.buyers.inviting')
              : t('portal.org.buyers.invite')
          }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="isLoading"
          data-testid="buyer-invite-cancel"
          @click="emit('cancel')"
        >
          {{ t('common.cancel') }}
        </Button>
      </div>
    </form>
  </div>
</template>
