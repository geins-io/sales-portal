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

// Call once in setup; getCountryOptions maps ~249 codes + sorts on every call.
const countryOptions = getCountryOptions(locale.value as SupportedLocale);

// Build reactive form values keyed by field name.
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

// Build a field-level schema map dynamically from data.fields.
function buildFieldSchemas(
  fields: FormWidgetField[],
): Record<string, z.ZodTypeAny> {
  const map: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.required) {
      if (field.type === 'email') {
        map[field.name] = z
          .string()
          .min(1, 'form.field_required')
          .email('form.invalid_email');
      } else {
        map[field.name] = z.string().min(1, 'form.field_required');
      }
    } else {
      map[field.name] = z.string();
    }
  }
  return map;
}

function validateField(name: string) {
  const fields = props.data?.fields ?? [];
  const schemas = buildFieldSchemas(fields);
  const fieldSchema = schemas[name];
  if (!fieldSchema) return;
  const result = fieldSchema.safeParse(formValues[name] ?? '');
  if (result.success) {
    fieldErrors[name] = '';
  } else {
    fieldErrors[name] =
      (result.error as z.ZodError).issues[0]?.message ?? '';
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

function handleSubmit() {
  if (!validateAll()) return;

  const fields = props.data?.fields ?? [];

  // Determine subject field: first field whose name contains 'company' (case-insensitive), else first field.
  const companyField = fields.find((f) =>
    f.name.toLowerCase().includes('company'),
  );
  const subjectField = companyField ?? fields[0];
  const companyValue = subjectField ? (formValues[subjectField.name] ?? '') : '';
  const subject = `Account application: ${companyValue}`;

  const mailtoFields = fields.map((f) => ({
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
      <Label :for="`form-field-input-${field.name}`">{{ field.label }}</Label>

      <!-- Select field -->
      <template v-if="field.type === 'select'">
        <Select
          :model-value="formValues[field.name] ?? ''"
          @update:model-value="
            (val) => handleSelectChange(field.name, String(val ?? ''))
          "
        >
          <SelectTrigger :id="`form-field-input-${field.name}`" class="w-full">
            <SelectValue :placeholder="t('apply.country_placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in countryOptions"
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
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          @blur="handleBlur(field.name)"
        />
      </template>

      <!-- Input (text or email) -->
      <template v-else>
        <Input
          :id="`form-field-input-${field.name}`"
          v-model="formValues[field.name]"
          :type="field.type === 'email' ? 'email' : 'text'"
          @blur="handleBlur(field.name)"
        />
      </template>

      <p
        v-if="touched[field.name] && fieldErrors[field.name]"
        class="text-destructive text-xs"
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
        class="text-muted-foreground text-sm"
        data-testid="form-fallback"
      >
        <i18n-t keypath="form.fallback_email" tag="span">
          <template #recipient>
            <a
              :href="`mailto:${data?.sendFormToEmail ?? ''}`"
              class="text-primary underline underline-offset-2"
            >{{ data?.sendFormToEmail ?? '' }}</a>
          </template>
        </i18n-t>
      </p>
    </div>
  </form>
</template>
