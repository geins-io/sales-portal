<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const applySchema = z.object({
  companyName: z.string().min(1, 'apply.field_required').max(200),
  organizationNumber: z.string().min(1, 'apply.field_required').max(50),
  firstName: z.string().min(1, 'apply.field_required').max(100),
  lastName: z.string().min(1, 'apply.field_required').max(100),
  email: z.string().min(1, 'apply.field_required').email('apply.invalid_email'),
  phone: z.string().max(50).optional(),
  message: z.string().max(5000).optional(),
});

const formData = reactive({
  companyName: '',
  organizationNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
});

const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});
const isLoading = ref(false);
const submitted = ref(false);
const errorMessage = ref('');

type FormField = keyof typeof formData;

const requiredFields: FormField[] = [
  'companyName',
  'organizationNumber',
  'firstName',
  'lastName',
  'email',
];

function validateField(field: FormField) {
  const shape = applySchema.shape[field];
  if (!shape) return;
  const result = shape.safeParse(formData[field] || undefined);
  if (result.success) {
    fieldErrors[field] = '';
  } else {
    fieldErrors[field] = result.error.issues[0]!.message;
  }
}

function handleBlur(field: FormField) {
  touched[field] = true;
  validateField(field);
}

function validateAll(): boolean {
  for (const field of requiredFields) {
    touched[field] = true;
    validateField(field);
  }
  return Object.values(fieldErrors).every((v) => !v);
}

async function handleSubmit() {
  errorMessage.value = '';
  if (!validateAll()) return;

  isLoading.value = true;
  try {
    await $fetch('/api/apply/submit', {
      method: 'POST',
      body: {
        companyName: formData.companyName,
        organizationNumber: formData.organizationNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
        message: formData.message || undefined,
      },
    });
    submitted.value = true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 429) {
      errorMessage.value = 'apply.too_many_attempts';
    } else {
      errorMessage.value = 'apply.error_message';
    }
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <!-- Success state -->
  <div
    v-if="submitted"
    data-testid="apply-success"
    class="space-y-3 py-4 text-center"
  >
    <div
      class="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full"
    >
      <Icon name="lucide:check" class="size-6" />
    </div>
    <h3 class="text-lg font-semibold">{{ t('apply.success_title') }}</h3>
    <p class="text-muted-foreground text-sm">
      {{ t('apply.success_message') }}
    </p>
  </div>

  <!-- Application form -->
  <form
    v-else
    data-testid="apply-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <!-- Error message -->
    <div
      v-if="errorMessage"
      data-testid="apply-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ t(errorMessage) }}
    </div>

    <!-- Company name -->
    <div class="space-y-2">
      <Label for="apply-company-name">{{ t('apply.company_name') }}</Label>
      <Input
        id="apply-company-name"
        v-model="formData.companyName"
        type="text"
        autocomplete="organization"
        :disabled="isLoading"
        data-testid="apply-company-name"
        @blur="handleBlur('companyName')"
      />
      <p
        v-if="touched.companyName && fieldErrors.companyName"
        class="text-destructive text-xs"
        data-testid="apply-company-name-error"
      >
        {{ t(fieldErrors.companyName) }}
      </p>
    </div>

    <!-- Organization number -->
    <div class="space-y-2">
      <Label for="apply-org-number">{{ t('apply.organization_number') }}</Label>
      <Input
        id="apply-org-number"
        v-model="formData.organizationNumber"
        type="text"
        :disabled="isLoading"
        data-testid="apply-org-number"
        @blur="handleBlur('organizationNumber')"
      />
      <p
        v-if="touched.organizationNumber && fieldErrors.organizationNumber"
        class="text-destructive text-xs"
        data-testid="apply-org-number-error"
      >
        {{ t(fieldErrors.organizationNumber) }}
      </p>
    </div>

    <!-- First name -->
    <div class="space-y-2">
      <Label for="apply-first-name">{{ t('apply.first_name') }}</Label>
      <Input
        id="apply-first-name"
        v-model="formData.firstName"
        type="text"
        autocomplete="given-name"
        :disabled="isLoading"
        data-testid="apply-first-name"
        @blur="handleBlur('firstName')"
      />
      <p
        v-if="touched.firstName && fieldErrors.firstName"
        class="text-destructive text-xs"
        data-testid="apply-first-name-error"
      >
        {{ t(fieldErrors.firstName) }}
      </p>
    </div>

    <!-- Last name -->
    <div class="space-y-2">
      <Label for="apply-last-name">{{ t('apply.last_name') }}</Label>
      <Input
        id="apply-last-name"
        v-model="formData.lastName"
        type="text"
        autocomplete="family-name"
        :disabled="isLoading"
        data-testid="apply-last-name"
        @blur="handleBlur('lastName')"
      />
      <p
        v-if="touched.lastName && fieldErrors.lastName"
        class="text-destructive text-xs"
        data-testid="apply-last-name-error"
      >
        {{ t(fieldErrors.lastName) }}
      </p>
    </div>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="apply-email">{{ t('apply.email') }}</Label>
      <Input
        id="apply-email"
        v-model="formData.email"
        type="email"
        autocomplete="email"
        :disabled="isLoading"
        data-testid="apply-email"
        @blur="handleBlur('email')"
      />
      <p
        v-if="touched.email && fieldErrors.email"
        class="text-destructive text-xs"
        data-testid="apply-email-error"
      >
        {{ t(fieldErrors.email) }}
      </p>
    </div>

    <!-- Phone (optional) -->
    <div class="space-y-2">
      <Label for="apply-phone">{{ t('apply.phone') }}</Label>
      <Input
        id="apply-phone"
        v-model="formData.phone"
        type="tel"
        autocomplete="tel"
        :disabled="isLoading"
        data-testid="apply-phone"
      />
    </div>

    <!-- Message (optional) -->
    <div class="space-y-2">
      <Label for="apply-message">{{ t('apply.message') }}</Label>
      <textarea
        id="apply-message"
        v-model="formData.message"
        rows="4"
        :disabled="isLoading"
        data-testid="apply-message"
        :class="[
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        ]"
      />
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="isLoading"
      data-testid="apply-submit"
    >
      {{ isLoading ? t('apply.submitting') : t('apply.submit') }}
    </Button>
  </form>
</template>
