<script setup lang="ts">
import type { GeinsUserType } from '@geins/types';
import { Button } from '~/components/ui/button';
import ProfileForm from '~/components/portal/ProfileForm.vue';

definePageMeta({
  middleware: 'auth',
});

const { t } = useI18n();

const { data: profileData, pending } = useFetch<{ profile: GeinsUserType }>(
  '/api/user/profile',
  {
    dedupe: 'defer',
  },
);

const profile = computed(() => profileData.value?.profile);

const profileFormRef = ref<InstanceType<typeof ProfileForm> | null>(null);
const isSaving = ref(false);

function handleProfileSaved(updated: GeinsUserType) {
  if (profileData.value) {
    profileData.value.profile = updated;
  }
}

async function handleSaveClick() {
  if (!profileFormRef.value) return;
  isSaving.value = true;
  try {
    await profileFormRef.value.submit();
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <PortalShell>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[180px_1fr]">
      <!-- Sub-nav sidebar -->
      <aside data-testid="account-sidebar" class="lg:pt-16">
        <nav class="flex flex-col gap-1">
          <div
            data-testid="account-sidebar-item"
            class="bg-muted text-foreground rounded-md px-3 py-2 text-sm font-medium"
            aria-current="page"
          >
            {{ t('portal.account.sidebar_label') }}
          </div>
        </nav>
      </aside>

      <!-- Main content -->
      <div data-testid="account-main" class="space-y-6">
        <!-- Header row: title + subtitle on left, Save button on right -->
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold">
              {{ t('portal.account.page_title') }}
            </h1>
            <p class="text-muted-foreground mt-1 text-sm">
              {{ t('portal.account.page_subtitle') }}
            </p>
          </div>
          <Button
            data-testid="account-save-button"
            :disabled="isSaving || pending"
            @click="handleSaveClick"
          >
            <Icon name="lucide:save" class="size-4" />
            {{ t('portal.account.save') }}
          </Button>
        </div>

        <!-- Unified panel containing both sections -->
        <div
          data-testid="account-panel"
          class="border-border bg-background rounded-lg border p-6 shadow-sm"
        >
          <div
            v-if="pending"
            class="text-muted-foreground py-8 text-center text-sm"
          >
            {{ t('common.loading') }}
          </div>
          <div v-else class="space-y-8">
            <!-- General information section -->
            <section data-testid="account-general-section">
              <h2 class="text-lg font-semibold">
                {{ t('portal.account.general_section') }}
              </h2>
              <p class="text-muted-foreground mt-1 mb-4 text-sm">
                {{ t('portal.account.general_section_hint') }}
              </p>
              <ProfileForm
                v-if="profile"
                ref="profileFormRef"
                :profile="profile"
                :hide-submit-button="true"
                @saved="handleProfileSaved"
              />
            </section>

            <!-- Divider -->
            <hr class="border-border" />

            <!-- Change password section -->
            <section data-testid="account-password-section">
              <h2 class="text-lg font-semibold">
                {{ t('portal.password.title') }}
              </h2>
              <p class="text-muted-foreground mt-1 mb-4 text-sm">
                {{ t('portal.password.subtitle') }}
              </p>
              <ChangePasswordForm />
            </section>
          </div>
        </div>
      </div>
    </div>
  </PortalShell>
</template>
