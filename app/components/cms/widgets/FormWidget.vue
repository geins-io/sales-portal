<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
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
  // Checkboxes in a group share one `name`, and so one error slot. Collected
  // first and written after the loop: assigning per box, a required option
  // left unticked would set the error and the next optional box in the same
  // group would immediately clear it, letting the form submit without it.
  const groupMissing = new Set<string>();
  const groupSeen = new Set<string>();

  for (const field of props.data?.fields ?? []) {
    touched[field.name] = true;
    if (field.type === 'checkbox') {
      groupSeen.add(field.name);
      // A required checkbox is a consent tick: it has to be ticked, where a
      // required text field only has to be non-empty.
      if (field.required && !checkedValues[checkboxKey(field)]) {
        groupMissing.add(field.name);
      }
      continue;
    }
    validateField(field.name);
  }

  for (const name of groupSeen) {
    fieldErrors[name] = groupMissing.has(name) ? 'form.field_required' : '';
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
/**
 * The heading a checkbox group reports under.
 *
 * Read from every box in the group rather than the one that happens to be
 * ticked first: `groupLabel` sits on the first option by convention, and if a
 * buyer leaves that one unticked the group would otherwise be reported under
 * a later option's own label — "Monitoring: Monitoring" instead of
 * "Interested in: Monitoring".
 */
function resolveGroupLabel(
  fields: FormWidgetField[],
  field: FormWidgetField,
): string {
  for (const candidate of fields) {
    if (candidate.name !== field.name) continue;
    if (candidate.groupLabel) return candidate.groupLabel;
  }
  return field.label;
}

/**
 * What the form renders, in declaration order: every field on its own, except
 * checkboxes carrying a `value`, which collapse into one entry per `name`.
 *
 * A valued box is one option of a multi-select group (see FormWidgetField) —
 * the group shares a name, so it shares a validation slot and an error line
 * too. Rendered flat, those boxes produced one wrapper each, all claiming the
 * same `name` for their key, test id and error id, and the error repeated
 * under every option. One entry per group gives the fieldset a single subject
 * and makes `name` unique again. A box with no `value` stands alone and keeps
 * its own row.
 */
type FormRenderEntry =
  | { kind: 'field'; key: string; field: FormWidgetField }
  | {
      kind: 'group';
      key: string;
      name: string;
      legend: string;
      required: boolean;
      fields: FormWidgetField[];
    };

const renderEntries = computed<FormRenderEntry[]>(() => {
  const fields = props.data?.fields ?? [];
  const entries: FormRenderEntry[] = [];
  const groupAt = new Map<string, number>();

  for (const field of fields) {
    if (field.type !== 'checkbox' || !field.value) {
      entries.push({ kind: 'field', key: `field:${field.name}`, field });
      continue;
    }
    const at = groupAt.get(field.name);
    if (at === undefined) {
      groupAt.set(field.name, entries.length);
      entries.push({
        kind: 'group',
        key: `group:${field.name}`,
        name: field.name,
        legend: resolveGroupLabel(fields, field),
        required: field.required,
        fields: [field],
      });
      continue;
    }
    const group = entries[at];
    if (group?.kind === 'group') {
      group.fields.push(field);
      // A group is required if any of its boxes is, which is how validateAll
      // already reads it.
      group.required ||= field.required;
    }
  }

  return entries;
});

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
        label: field.value ? resolveGroupLabel(fields, field) : field.label,
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

/**
 * The prompt shown before a choice is made. It has to follow the same branch
 * selectOptionsFor takes: the country prompt is only honest when the list
 * actually is countries, and every other select was showing it regardless.
 */
function selectPlaceholderFor(field: FormWidgetField): string {
  if (field.placeholder) return field.placeholder;
  if (field.options && field.options.length > 0) {
    return t('form.select_placeholder');
  }
  return t('form.country_placeholder');
}
</script>

<template>
  <form
    class="max-w-lg space-y-4"
    data-testid="form-widget"
    @submit.prevent="handleSubmit"
  >
    <!--
      A checkbox group is one control, not several: the boxes share a name,
      answer one question and report one error, so they get one fieldset with
      the group's heading as its legend. Grouping also restores unique identity
      to the wrapper — with a row per box, `name` repeated across every member
      of the group. A box with no `value` stands alone and keeps its own row.
    -->
    <template v-for="entry in renderEntries" :key="entry.key">
      <fieldset
        v-if="entry.kind === 'group'"
        class="space-y-2"
        :data-testid="`form-field-${entry.name}`"
      >
        <legend class="mb-2 text-sm font-medium">
          {{ entry.legend }}
          <span
            v-if="entry.required"
            class="text-danger ms-0.5"
            aria-hidden="true"
            >*</span
          >
        </legend>

        <label
          v-for="option in entry.fields"
          :key="checkboxKey(option)"
          class="flex items-start gap-2 text-sm"
          :data-testid="`form-checkbox-${checkboxKey(option)}`"
        >
          <Checkbox
            :id="`form-field-checkbox-${checkboxKey(option)}`"
            v-model="checkedValues[checkboxKey(option)]"
            class="mt-0.5"
            :aria-invalid="
              touched[entry.name] && !!fieldErrors[entry.name]
                ? 'true'
                : undefined
            "
            :aria-describedby="
              touched[entry.name] && fieldErrors[entry.name]
                ? `form-field-${entry.name}-error`
                : undefined
            "
            :required="entry.required"
          />
          <span>{{ option.label }}</span>
        </label>

        <p
          v-if="touched[entry.name] && fieldErrors[entry.name]"
          :id="`form-field-${entry.name}-error`"
          class="text-danger text-xs"
          role="alert"
          :data-testid="`form-field-${entry.name}-error`"
        >
          {{ t(fieldErrors[entry.name] ?? '') }}
        </p>
      </fieldset>

      <div
        v-else
        class="space-y-2"
        :data-testid="`form-field-${entry.field.name}`"
      >
        <Label
          v-if="entry.field.type !== 'checkbox'"
          :for="`form-field-input-${entry.field.name}`"
        >
          {{ entry.field.label }}
          <span
            v-if="entry.field.required"
            class="text-danger ms-0.5"
            aria-hidden="true"
            >*</span
          >
        </Label>

        <!-- Standalone tick; grouped boxes render in the fieldset above -->
        <template v-if="entry.field.type === 'checkbox'">
          <label class="flex items-start gap-2 text-sm">
            <Checkbox
              :id="`form-field-checkbox-${checkboxKey(entry.field)}`"
              v-model="checkedValues[checkboxKey(entry.field)]"
              class="mt-0.5"
              :aria-invalid="
                touched[entry.field.name] && !!fieldErrors[entry.field.name]
                  ? 'true'
                  : undefined
              "
              :aria-describedby="
                touched[entry.field.name] && fieldErrors[entry.field.name]
                  ? `form-field-${entry.field.name}-error`
                  : undefined
              "
              :required="entry.field.required"
            />
            <span>
              {{ entry.field.label }}
              <span
                v-if="entry.field.required"
                class="text-danger ms-0.5"
                aria-hidden="true"
                >*</span
              >
            </span>
          </label>
        </template>

        <!-- Select field -->
        <template v-else-if="entry.field.type === 'select'">
          <Select
            :model-value="formValues[entry.field.name] ?? ''"
            @update:model-value="
              (val) => handleSelectChange(entry.field.name, String(val ?? ''))
            "
          >
            <SelectTrigger
              :id="`form-field-input-${entry.field.name}`"
              class="w-full"
              :aria-invalid="
                touched[entry.field.name] && !!fieldErrors[entry.field.name]
                  ? 'true'
                  : undefined
              "
              :aria-describedby="
                touched[entry.field.name] && fieldErrors[entry.field.name]
                  ? `form-field-${entry.field.name}-error`
                  : undefined
              "
              :aria-required="entry.field.required ? 'true' : undefined"
            >
              <SelectValue :placeholder="selectPlaceholderFor(entry.field)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in selectOptionsFor(entry.field)"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </template>

        <!-- Textarea field -->
        <template v-else-if="entry.field.type === 'textarea'">
          <textarea
            :id="`form-field-input-${entry.field.name}`"
            v-model="formValues[entry.field.name]"
            class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            :aria-invalid="
              touched[entry.field.name] && !!fieldErrors[entry.field.name]
                ? 'true'
                : undefined
            "
            :aria-describedby="
              touched[entry.field.name] && fieldErrors[entry.field.name]
                ? `form-field-${entry.field.name}-error`
                : undefined
            "
            :aria-required="entry.field.required ? 'true' : undefined"
            @blur="handleBlur(entry.field.name)"
          />
        </template>

        <!-- Input (text or email) -->
        <template v-else>
          <Input
            :id="`form-field-input-${entry.field.name}`"
            v-model="formValues[entry.field.name]"
            :type="entry.field.type === 'email' ? 'email' : 'text'"
            :aria-invalid="
              touched[entry.field.name] && !!fieldErrors[entry.field.name]
                ? 'true'
                : undefined
            "
            :aria-describedby="
              touched[entry.field.name] && fieldErrors[entry.field.name]
                ? `form-field-${entry.field.name}-error`
                : undefined
            "
            :aria-required="entry.field.required ? 'true' : undefined"
            @blur="handleBlur(entry.field.name)"
          />
        </template>

        <p
          v-if="touched[entry.field.name] && fieldErrors[entry.field.name]"
          :id="`form-field-${entry.field.name}-error`"
          class="text-danger text-xs"
          role="alert"
          :data-testid="`form-field-${entry.field.name}-error`"
        >
          {{ t(fieldErrors[entry.field.name] ?? '') }}
        </p>
      </div>
    </template>

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
