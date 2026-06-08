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
import type { ContentConfigType, FormWidgetData, FormWidgetField } from '#shared/types/cms';
import type { SupportedLocale } from '#shared/utils/locale-market';
import { getCountryOptions } from '~/utils/country-options';
import { buildMailto } from '~/utils/mailto';
import { safeLocationRedirect } from '~/utils/client-helpers';

const props = defineProps<{
  data: FormWidgetData;
  config: ContentConfigType;
  layout: string;
}>();

const { t, locale } = useI18n();

// Computed so it reacts to locale changes without re-running on every render.
const countryOptions = computed(() =>
  getCountryOptions(locale.value as SupportedLocale),
);

const formValues = reactive<Record<string, string>>({});
const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});

// Initialise formValues when data resolves (SSR-safe: data may be null on first render).
watchEffect(() => {
  for (const field of props.data?.fields ?? []) {
    if (!(field.name in formValues)) {
      formValues[field.name] = '';
    }
  }
});

// Build schema map once per fields change; validateField looks up by name.
const fieldSchemaMap = computed(() => {
  const map: Record<string, z.ZodTypeAny> = {};
  for (const field of props.data?.fields ?? []) {
    if (field.type === 'email') {
      // Apply email format validation regardless of required so partial fills
      // that contain an invalid address still show an error.
      if (field.required) {
        map[field.name] = z
          .string()
          .min(1, 'form.field_required')
          .email('form.invalid_email');
      } else {
        map[field.name] = z
          .string()
          .refine((v) => v === '' || z.string().email().safeParse(v).success, {
            message: 'form.invalid_email',
          });
      }
    } else if (field.required) {
      map[field.name] = z.string().min(1, 'form.field_required');
    } else {
      map[field.name] = z.string();
    }
  }
  return map;
});

function validateField(name: string) {
  const fieldSchema = fieldSchemaMap.value[name];
  if (!fieldSchema) return;
  const result = fieldSchema.safeParse(formValues[name] ?? '');
  if (result.success) {
    fieldErrors[name] = '';
  } else {
    fieldErrors[name] = result.error.issues[0]?.message ?? '';
  }
}

function handleBlur(name: string) {
  touched[name] = true;
  validateField(name);
}

function handleSelectChange(name: string, val: string) {
  formValues[name] = val;
  touched[name] = true;
  validateField(name);
}

function validateAll(): boolean {
  for (const field of props.data?.fields ?? []) {
    touched[field.name] = true;
    validateField(field.name);
  }
  return Object.values(fieldErrors).every((v) => !v);
}

defineExpose({ formValues, fieldErrors, touched, handleSubmit, validateAll });

// Company-field detection: match first field whose name (lowercased) contains
// any of the known company-name tokens, or fall back to first field.
const COMPANY_TOKENS = ['company', 'companyname', 'foretag', 'företag', 'firma', 'bolag'];

function handleSubmit() {
  if (!validateAll()) return;

  const fields = props.data?.fields ?? [];

  const companyField =
    fields.find((f) =>
      COMPANY_TOKENS.some((tok) => f.name.toLowerCase().includes(tok)),
    ) ?? fields[0];
  const companyValue = companyField ? (formValues[companyField.name] ?? '') : '';
  const subject = `Account application: ${companyValue}`;

  const mailtoFields = fields.map((f: FormWidgetField) => ({
    label: f.label,
    value: formValues[f.name] ?? '',
  }));

  const url = buildMailto({
    recipient: props.data?.sendFormToEmail ?? '',
    subject,
    fields: mailtoFields,
  });

  safeLocationRedirect(url);
}

// Derive the options for a select field: prefer CMS-supplied options when
// non-empty; fall back to locale-aware country list.
function selectOptionsFor(field: FormWidgetField) {
  if (field.options && field.options.length > 0) {
    return field.options;
  }
  return countryOptions.value;
}
</script>

<template>
  <form
    class="space-y-4"
    data-testid="form-widget"
    @submit.prevent="handleSubmit"
  >
    <div
      v-for="field in data?.fields ?? []"
      :key="field.name"
      class="space-y-2"
      :data-testid="`form-field-${field.name}`"
    >
      <Label :for="`form-field-input-${field.name}`">
        {{ field.label }}
        <span
          v-if="field.required"
          class="text-destructive ms-0.5"
          aria-hidden="true"
        >*</span>
      </Label>

      <!-- Select field -->
      <template v-if="field.type === 'select'">
        <Select
          :model-value="formValues[field.name] ?? ''"
          @update:model-value="
            (val) => handleSelectChange(field.name, String(val ?? ''))
          "
        >
          <SelectTrigger
            :id="`form-field-input-${field.name}`"
            class="w-full"
            :aria-invalid="
              touched[field.name] && !!fieldErrors[field.name] ? 'true' : undefined
            "
            :aria-describedby="
              touched[field.name] && fieldErrors[field.name]
                ? `form-field-${field.name}-error`
                : undefined
            "
            :aria-required="field.required ? 'true' : undefined"
          >
            <SelectValue :placeholder="t('form.country_placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in selectOptionsFor(field)"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>

      <!-- Textarea field -->
      <template v-else-if="field.type === 'textarea'">
        <textarea
          :id="`form-field-input-${field.name}`"
          v-model="formValues[field.name]"
          class="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :aria-invalid="
            touched[field.name] && !!fieldErrors[field.name] ? 'true' : undefined
          "
          :aria-describedby="
            touched[field.name] && fieldErrors[field.name]
              ? `form-field-${field.name}-error`
              : undefined
          "
          :aria-required="field.required ? 'true' : undefined"
          @blur="handleBlur(field.name)"
        />
      </template>

      <!-- Input (text or email) -->
      <template v-else>
        <Input
          :id="`form-field-input-${field.name}`"
          v-model="formValues[field.name]"
          :type="field.type === 'email' ? 'email' : 'text'"
          :aria-invalid="
            touched[field.name] && !!fieldErrors[field.name] ? 'true' : undefined
          "
          :aria-describedby="
            touched[field.name] && fieldErrors[field.name]
              ? `form-field-${field.name}-error`
              : undefined
          "
          :aria-required="field.required ? 'true' : undefined"
          @blur="handleBlur(field.name)"
        />
      </template>

      <p
        v-if="touched[field.name] && fieldErrors[field.name]"
        :id="`form-field-${field.name}-error`"
        class="text-destructive text-xs"
        role="alert"
        :data-testid="`form-field-${field.name}-error`"
      >
        {{ t(fieldErrors[field.name] ?? '') }}
      </p>
    </div>

    <div class="border-border flex flex-col items-start gap-3 border-t pt-4">
      <Button type="submit" data-testid="form-submit">
        {{ t('form.send_application') }}
      </Button>

      <p
        v-if="data?.sendFormToEmail"
        class="text-muted-foreground text-sm"
        data-testid="form-fallback"
      >
        <i18n-t keypath="form.fallback_email" tag="span">
          <template #recipient>
            <a
              :href="`mailto:${data.sendFormToEmail}`"
              class="text-primary underline underline-offset-2"
            >{{ data.sendFormToEmail }}</a>
          </template>
        </i18n-t>
      </p>
    </div>
  </form>
</template>
