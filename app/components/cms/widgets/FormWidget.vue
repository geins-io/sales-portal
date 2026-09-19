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
import type {
  ContentConfigType,
  FormWidgetData,
  FormWidgetField,
} from '#shared/types/cms';
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
// Checkboxes are kept apart from the text map: a group shares one name and
// holds several values at once, which a flat string map cannot express.
const checkedValues = reactive<Record<string, boolean>>({});

/**
 * Identity of one checkbox. A group shares `name` and differs by `value`, so
 * state is keyed by both — keyed by name alone, ticking one would untick its
 * siblings.
 */
function checkboxKey(field: FormWidgetField): string {
  return field.value ? `${field.name}:${field.value}` : field.name;
}
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
    if (field.type === 'checkbox') {
      // Ticked state is a boolean, not a string; validated in validateAll.
      continue;
    }
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
    if (field.type === 'checkbox') {
      // A required checkbox is a consent tick: it has to be ticked, where a
      // required text field only has to be non-empty.
      fieldErrors[field.name] =
        field.required && !checkedValues[checkboxKey(field)]
          ? 'form.field_required'
          : '';
      continue;
    }
    validateField(field.name);
  }
  return Object.values(fieldErrors).every((v) => !v);
}

defineExpose({ formValues, fieldErrors, touched, handleSubmit, validateAll });

// Subject is configured per widget so each form (apply, contact, ...) owns its
// own. `{fieldName}` placeholders are filled from the submitted values, e.g.
// "Account application: {company}". When no subject is configured we fall back
// to the CMS template name, then a neutral default — never a hardcoded subject
// that would be wrong for a different form.
function resolveSubject(): string {
  const configured = props.data?.subject?.trim();
  if (configured) {
    return configured.replace(/\{(\w+)\}/g, (_match, name: string) =>
      (formValues[name] ?? '').trim(),
    );
  }
  return props.data?.templateName?.trim() || t('form.default_subject');
}

/**
 * One reported line per field, in the order the form declares them.
 *
 * Checkboxes sharing a `name` are one group and report on a single line, so a
 * three-option multi-select reads "Interested in: A, B" rather than repeating
 * the whole answer under each option's own label. Fields left empty are
 * omitted: an unfilled optional field would otherwise contribute a bare
 * "Label:" line, and a long form is mostly optional fields.
 */
function buildMailtoFields(
  fields: FormWidgetField[],
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const groupIndex = new Map<string, number>();

  for (const field of fields) {
    if (field.type === 'checkbox') {
      if (!checkedValues[checkboxKey(field)]) continue;
      // A box with no `value` is a standalone tick, so its own label is the
      // question and the answer is simply that it was ticked.
      const answer = field.value ?? t('form.checkbox_checked');
      const existing = groupIndex.get(field.name);
      if (existing !== undefined) {
        const line = lines[existing];
        if (line) line.value = `${line.value}, ${answer}`;
        continue;
      }
      groupIndex.set(field.name, lines.length);
      lines.push({
        label: field.value ? (field.groupLabel ?? field.label) : field.label,
        value: answer,
      });
      continue;
    }

    const value = (formValues[field.name] ?? '').trim();
    if (!value) continue;
    lines.push({ label: field.label, value });
  }

  return lines;
}

function handleSubmit() {
  if (!validateAll()) return;

  const fields = props.data?.fields ?? [];

  const mailtoFields = buildMailtoFields(fields);

  const url = buildMailto({
    recipient: props.data?.sendFormToEmail ?? '',
    subject: resolveSubject(),
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
    class="max-w-lg space-y-4"
    data-testid="form-widget"
    @submit.prevent="handleSubmit"
  >
    <div
      v-for="field in data?.fields ?? []"
      :key="field.name"
      class="space-y-2"
      :data-testid="`form-field-${field.name}`"
    >
      <Label
        v-if="field.type !== 'checkbox'"
        :for="`form-field-input-${field.name}`"
      >
        {{ field.label }}
        <span
          v-if="field.required"
          class="text-destructive ms-0.5"
          aria-hidden="true"
          >*</span
        >
      </Label>

      <!-- Checkbox: one of a named group, or a standalone consent tick -->
      <template v-if="field.type === 'checkbox'">
        <label class="flex items-start gap-2 text-sm">
          <input
            :id="`form-field-input-${field.name}`"
            v-model="checkedValues[checkboxKey(field)]"
            type="checkbox"
            class="border-input accent-primary mt-0.5 size-4 rounded border"
            :aria-invalid="
              touched[field.name] && !!fieldErrors[field.name]
                ? 'true'
                : undefined
            "
            :aria-describedby="
              touched[field.name] && fieldErrors[field.name]
                ? `form-field-${field.name}-error`
                : undefined
            "
            :aria-required="field.required ? 'true' : undefined"
          />
          <span>
            {{ field.label }}
            <span
              v-if="field.required"
              class="text-destructive ms-0.5"
              aria-hidden="true"
              >*</span
            >
          </span>
        </label>
      </template>

      <!-- Select field -->
      <template v-else-if="field.type === 'select'">
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
              touched[field.name] && !!fieldErrors[field.name]
                ? 'true'
                : undefined
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
          class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :aria-invalid="
            touched[field.name] && !!fieldErrors[field.name]
              ? 'true'
              : undefined
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
            touched[field.name] && !!fieldErrors[field.name]
              ? 'true'
              : undefined
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
        {{ data?.submitLabel?.trim() || t('form.submit') }}
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
              >{{ data.sendFormToEmail }}</a
            >
          </template>
        </i18n-t>
      </p>
    </div>
  </form>
</template>
