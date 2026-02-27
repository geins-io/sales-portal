<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { Card, CardContent } from '~/components/ui/card';

const props = withDefaults(
  defineProps<{
    defaultTab?: 'login' | 'register';
  }>(),
  { defaultTab: 'login' },
);

const activeTab = ref(props.defaultTab);
</script>

<template>
  <div
    class="bg-muted/50 flex min-h-screen items-center justify-center px-4 py-12"
    data-testid="auth-card"
  >
    <div class="w-full max-w-md">
      <!-- Tenant logo -->
      <div class="mb-8 flex justify-center">
        <BrandLogo class="h-10" />
      </div>

      <Card>
        <CardContent class="pt-6">
          <Tabs v-model="activeTab" :default-value="defaultTab">
            <TabsList class="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="login">
                {{ $t('auth.sign_in') }}
              </TabsTrigger>
              <TabsTrigger value="register">
                {{ $t('auth.apply_for_account') }}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <slot name="login" />
            </TabsContent>

            <TabsContent value="register">
              <slot name="register" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
