<script setup lang="ts">
import { z } from 'zod';
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
import { Checkbox } from '~/components/ui/checkbox';

const { t, locale } = useI18n();
const { localePath } = useLocaleMarket();

const TERMS_ALIAS = { sv: '/vilkor' } as const;
const termsPath = computed(
  () => TERMS_ALIAS[locale.value as keyof typeof TERMS_ALIAS] ?? '/terms',
);

// Client-side schema mirrors server ApplyForAccountSchema (not imported — server-only types)
const applySchema = z.object({
  companyName: z.string().min(1, 'apply.field_required').max(200),
  organizationNumber: z.string().min(1, 'apply.field_required').max(50),
  firstName: z.string().min(1, 'apply.field_required').max(100),
  lastName: z.string().min(1, 'apply.field_required').max(100),
  country: z.enum(['SE', 'NO', 'DK', 'FI', 'DE', 'GB'], {
    error: 'apply.field_required',
  }),
  email: z.string().min(1, 'apply.field_required').email('apply.invalid_email'),
  password: z
    .string()
    .min(1, 'apply.field_required')
    .min(8, 'apply.password_min_length'),
  acceptTerms: z.literal(true, { error: 'apply.accept_terms_required' }),
  phone: z.string().max(50).optional(),
  message: z.string().max(5000).optional(),
});

type FormData = {
  companyName: string;
  organizationNumber: string;
  firstName: string;
  lastName: string;
  country: string;
  email: string;
  password: string;
  acceptTerms: boolean;
  phone: string;
  message: string;
};

const formData = reactive<FormData>({
  companyName: '',
  organizationNumber: '',
  firstName: '',
  lastName: '',
  country: '',
  email: '',
  password: '',
  acceptTerms: false,
  phone: '',
  message: '',
});

const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});
const isLoading = ref(false);
const errorMessage = ref('');
const showPassword = ref(false);

const router = useRouter();

type FormField = keyof FormData;

const requiredFields: FormField[] = [
  'companyName',
  'organizationNumber',
  'firstName',
  'lastName',
  'country',
  'email',
  'password',
  'acceptTerms',
];

const countryOptions = [
  { value: 'SE', key: 'apply.country_sweden' },
  { value: 'NO', key: 'apply.country_norway' },
  { value: 'DK', key: 'apply.country_denmark' },
  { value: 'FI', key: 'apply.country_finland' },
  { value: 'DE', key: 'apply.country_germany' },
  { value: 'GB', key: 'apply.country_uk' },
] as const;

function validateField(field: FormField) {
  const shape = applySchema.shape[field as keyof typeof applySchema.shape];
  if (!shape) return;
  const rawValue = formData[field];
  const parseValue =
    rawValue === '' || rawValue === false ? undefined : rawValue;
  const result = shape.safeParse(parseValue);
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
        country: formData.country,
        email: formData.email,
        password: formData.password,
        acceptTerms: formData.acceptTerms as true,
        phone: formData.phone || undefined,
        message: formData.message || undefined,
      },
    });
    // Backend registers + promotes to ORGANIZATION + sets auth cookies,
    // so the user is logged in. Redirect to portal with a ?applied=1
    // query param which the pending-approval banner reads.
    await router.push(`${localePath('/portal')}?applied=1`);
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
  <!-- Application form — on successful submit the user is redirected to
       /portal?applied=1 so the pending-approval banner can welcome them. -->
  <form
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

    <!-- Company name + Organization number -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div class="space-y-2">
        <Label for="apply-org-number">{{
          t('apply.organization_number')
        }}</Label>
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
    </div>

    <!-- First name + Last name -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </div>

    <!-- Country -->
    <div class="space-y-2">
      <Label for="apply-country">{{ t('apply.country') }}</Label>
      <Select
        :model-value="formData.country"
        :disabled="isLoading"
        data-testid="apply-country"
        @update:model-value="
          (val) => {
            formData.country = String(val ?? '');
            touched.country = true;
            validateField('country');
          }
        "
      >
        <SelectTrigger id="apply-country" class="w-full">
          <SelectValue :placeholder="t('apply.country_placeholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in countryOptions"
            :key="opt.value"
            :value="opt.value"
            data-testid="apply-country-option"
            :data-value="opt.value"
          >
            {{ t(opt.key) }}
          </SelectItem>
        </SelectContent>
      </Select>
      <p
        v-if="touched.country && fieldErrors.country"
        class="text-destructive text-xs"
        data-testid="apply-country-error"
      >
        {{ t(fieldErrors.country) }}
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

    <!-- Password -->
    <div class="space-y-2">
      <Label for="apply-password">{{ t('apply.password') }}</Label>
      <div class="relative">
        <Input
          id="apply-password"
          v-model="formData.password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :disabled="isLoading"
          data-testid="apply-password"
          @blur="handleBlur('password')"
        />
        <button
          type="button"
          tabindex="-1"
          class="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          data-testid="apply-password-toggle"
          :aria-label="
            showPassword ? t('apply.hide_password') : t('apply.show_password')
          "
          @click="showPassword = !showPassword"
        >
          <Icon
            :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
            class="size-4"
          />
        </button>
      </div>
      <p
        v-if="touched.password && fieldErrors.password"
        class="text-destructive text-xs"
        data-testid="apply-password-error"
      >
        {{ t(fieldErrors.password) }}
      </p>
    </div>

    <!-- Accept Terms -->
    <div class="space-y-2">
      <div class="flex items-start gap-2">
        <Checkbox
          id="apply-terms"
          :checked="formData.acceptTerms"
          :disabled="isLoading"
          data-testid="apply-terms"
          @update:checked="
            (val: boolean | 'indeterminate') => {
              formData.acceptTerms = Boolean(val);
              touched.acceptTerms = true;
              validateField('acceptTerms');
            }
          "
        />
        <Label for="apply-terms" class="text-sm leading-relaxed">
          {{ t('apply.accept_terms_label') }}
          <NuxtLink
            :to="localePath(termsPath)"
            class="text-primary underline underline-offset-2"
            data-testid="apply-terms-link"
          >
            {{ t('apply.accept_terms_label') }}
          </NuxtLink>
        </Label>
      </div>
      <p
        v-if="touched.acceptTerms && fieldErrors.acceptTerms"
        class="text-destructive text-xs"
        data-testid="apply-terms-error"
      >
        {{ t(fieldErrors.acceptTerms) }}
      </p>
    </div>

    <!-- Additional information -->
    <div class="space-y-4">
      <p class="text-muted-foreground text-sm font-medium">
        {{ t('apply.additional_information') }}
      </p>

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
          class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>

    <!-- Submit -->
    <div class="flex justify-end">
      <Button type="submit" :disabled="isLoading" data-testid="apply-submit">
        {{ isLoading ? t('apply.submitting') : t('apply.submit') }}
      </Button>
    </div>
  </form>
</template>
