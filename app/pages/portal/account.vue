<script setup lang="ts">
import type { GeinsUserType } from '@geins/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '~/components/ui/card';

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

function handleProfileSaved(updated: GeinsUserType) {
  if (profileData.value) {
    profileData.value.profile = updated;
  }
}
</script>

<template>
  <PortalShell>
    <div class="space-y-8">
      <!-- Profile Section -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('portal.account.title') }}</CardTitle>
          <CardDescription>{{ t('portal.account.subtitle') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            v-if="pending"
            class="text-muted-foreground py-8 text-center text-sm"
          >
            Loading...
          </div>
          <ProfileForm
            v-else-if="profile"
            :profile="profile"
            @saved="handleProfileSaved"
          />
        </CardContent>
      </Card>

      <!-- Password Change Section -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('portal.password.title') }}</CardTitle>
          <CardDescription>{{ t('portal.password.subtitle') }}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  </PortalShell>
</template>
