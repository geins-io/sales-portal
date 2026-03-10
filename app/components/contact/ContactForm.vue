<script setup lang="ts">
import { z } from 'zod';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';

const { t } = useI18n();

const contactSchema = z.object({
  name: z.string().min(1, 'contact.field_required').max(100),
  email: z
    .string()
    .min(1, 'contact.field_required')
    .email('contact.invalid_email'),
  phone: z.string().max(50).optional(),
  subject: z.string().min(1, 'contact.field_required').max(200),
  message: z.string().min(1, 'contact.field_required').max(5000),
});

const formData = reactive({
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
});

const fieldErrors = reactive<Record<string, string>>({});
const touched = reactive<Record<string, boolean>>({});
const isLoading = ref(false);
const submitted = ref(false);
const errorMessage = ref('');

function validateField(field: keyof typeof formData) {
  const shape = contactSchema.shape[field];
  if (!shape) return;
  const result = shape.safeParse(formData[field] || undefined);
  if (result.success) {
    fieldErrors[field] = '';
  } else {
    fieldErrors[field] = result.error.issues[0]!.message;
  }
}

function handleBlur(field: keyof typeof formData) {
  touched[field] = true;
  validateField(field);
}

function validateAll(): boolean {
  const fields: (keyof typeof formData)[] = [
    'name',
    'email',
    'subject',
    'message',
  ];
  for (const field of fields) {
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
    await $fetch('/api/contact/submit', {
      method: 'POST',
      body: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message,
      },
    });
    submitted.value = true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 429) {
      errorMessage.value = 'contact.too_many_attempts';
    } else {
      errorMessage.value = 'contact.error_message';
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
    data-testid="contact-success"
    class="space-y-3 py-4 text-center"
  >
    <div
      class="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full"
    >
      <Icon name="lucide:check" class="size-6" />
    </div>
    <h3 class="text-lg font-semibold">{{ t('contact.success_title') }}</h3>
    <p class="text-muted-foreground text-sm">
      {{ t('contact.success_message') }}
    </p>
  </div>

  <!-- Contact form -->
  <form
    v-else
    data-testid="contact-form"
    class="space-y-4"
    @submit.prevent="handleSubmit"
  >
    <!-- Error message -->
    <div
      v-if="errorMessage"
      data-testid="contact-error"
      class="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
    >
      {{ t(errorMessage) }}
    </div>

    <!-- Name -->
    <div class="space-y-2">
      <Label for="contact-name">{{ t('contact.name') }}</Label>
      <Input
        id="contact-name"
        v-model="formData.name"
        type="text"
        autocomplete="name"
        :disabled="isLoading"
        data-testid="contact-name"
        @blur="handleBlur('name')"
      />
      <p
        v-if="touched.name && fieldErrors.name"
        class="text-destructive text-xs"
        data-testid="contact-name-error"
      >
        {{ t(fieldErrors.name) }}
      </p>
    </div>

    <!-- Email -->
    <div class="space-y-2">
      <Label for="contact-email">{{ t('contact.email') }}</Label>
      <Input
        id="contact-email"
        v-model="formData.email"
        type="email"
        autocomplete="email"
        :disabled="isLoading"
        data-testid="contact-email"
        @blur="handleBlur('email')"
      />
      <p
        v-if="touched.email && fieldErrors.email"
        class="text-destructive text-xs"
        data-testid="contact-email-error"
      >
        {{ t(fieldErrors.email) }}
      </p>
    </div>

    <!-- Phone (optional) -->
    <div class="space-y-2">
      <Label for="contact-phone">{{ t('contact.phone') }}</Label>
      <Input
        id="contact-phone"
        v-model="formData.phone"
        type="tel"
        autocomplete="tel"
        :disabled="isLoading"
        data-testid="contact-phone"
      />
    </div>

    <!-- Subject -->
    <div class="space-y-2">
      <Label for="contact-subject">{{ t('contact.subject') }}</Label>
      <Input
        id="contact-subject"
        v-model="formData.subject"
        type="text"
        :disabled="isLoading"
        data-testid="contact-subject"
        @blur="handleBlur('subject')"
      />
      <p
        v-if="touched.subject && fieldErrors.subject"
        class="text-destructive text-xs"
        data-testid="contact-subject-error"
      >
        {{ t(fieldErrors.subject) }}
      </p>
    </div>

    <!-- Message -->
    <div class="space-y-2">
      <Label for="contact-message">{{ t('contact.message') }}</Label>
      <textarea
        id="contact-message"
        v-model="formData.message"
        rows="5"
        :disabled="isLoading"
        data-testid="contact-message"
        :class="[
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        ]"
        @blur="handleBlur('message')"
      />
      <p
        v-if="touched.message && fieldErrors.message"
        class="text-destructive text-xs"
        data-testid="contact-message-error"
      >
        {{ t(fieldErrors.message) }}
      </p>
    </div>

    <!-- Submit -->
    <Button
      type="submit"
      class="w-full"
      :disabled="isLoading"
      data-testid="contact-submit"
    >
      {{ isLoading ? t('contact.submitting') : t('contact.submit') }}
    </Button>
  </form>
</template>
