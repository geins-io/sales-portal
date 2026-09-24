<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core';
import type { FetchResponse } from 'ofetch';
import type {
  CommittedConfiguration,
  Configuration,
  ConfigurationChange,
  ConfigurationMessage,
  ConfigurationSection,
  ConfigurationOptionGroup,
  ConfigurationValue,
  ConfigurationVariable,
} from '#shared/types/configurator';
import type { PriceType } from '#shared/types/commerce';
import { currencyCode, exVatAmount } from '#shared/utils/configurator-price';
import { useAuthStore } from '~/stores/auth';

// ---------------------------------------------------------------------------
// Developer page for the product configurator.
//
// The shape of a configuration — sections inside sections, option groups
// holding option groups, provenance on every row — is what this milestone has
// to get right, and a type does not show it. The page renders the whole
// document as one flat indented list so the contract can be read in a browser
// weeks before a buyer-facing page exists.
//
// Nothing here is meant to survive: no components, no styling past spacing.
// It is not linked from any menu and every response is shown raw underneath.
// ---------------------------------------------------------------------------

definePageMeta({ layout: false });

useHead({
  title: 'Configurator preview',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

const { tenant, suspense } = useTenant();
const { canAccess } = useFeatureAccess();
const auth = useAuthStore();

if (!tenant.value) await suspense();
// `access: 'authenticated'` reads the auth store, so an unresolved store makes
// a signed-in user look anonymous. Mirrors app/middleware/feature.ts.
if (!auth.isInitialized) await auth.fetchUser();

// The same 404 the routes answer, rather than the redirect home the feature
// middleware does: a page that may not exist should not hint that it does.
if (!canAccess('configurator')) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' });
}

// ---------------------------------------------------------------------------
// The seeded products
// ---------------------------------------------------------------------------
/**
 * `?product=` takes the Geins product id, which is what the create route
 * resolves a seed by — the same id the catalogue knows the product as. The
 * article number is the readable half of the label and is not a key; nothing
 * maps one to the other.
 */
const WORKBENCH = '1101';

const PRODUCTS: { productId: string; label: string }[] = [
  { productId: WORKBENCH, label: 'Arbetsbord Pro · KONF-1001' },
  { productId: '1102', label: 'Skåpsektion Pro · KONF-1002' },
  { productId: '1103', label: 'Monteringsstation Pro · KONF-1003' },
];

const route = useRoute();
const productId = computed(() => {
  const asked = route.query.product;
  return typeof asked === 'string' && asked ? asked : WORKBENCH;
});

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------
const config = ref<Configuration | null>(null);
const committed = ref<CommittedConfiguration | null>(null);
const lastResponse = ref<unknown>(null);
const outcome = ref('');
const failure = ref('');
const backendOff = ref(false);
const finished = ref(false);
const busy = ref(false);

interface RequestFailure {
  statusCode?: number;
  data?: { message?: string; statusMessage?: string };
}

/**
 * The server's own text, not a message invented here. Outside
 * `NODE_ENV=development` `createAppError` replaces it with a generic one, so
 * this reads thinner on a deployed environment than it does locally.
 */
function describe(error: unknown): { status: number; text: string } {
  const failed = error as RequestFailure;
  return {
    status: failed.statusCode ?? 0,
    text:
      failed.data?.message ??
      failed.data?.statusMessage ??
      'the request failed',
  };
}

/**
 * The status is part of what this page shows, so every verb reads the raw
 * response rather than the decoded body: a 204 must not be reported as a 200.
 * The url stays a template literal at each call site — widening it to `string`
 * makes Nitro's route-type inference blow its stack.
 */
function received<T>(response: FetchResponse<T>): {
  status: number;
  body: T | undefined;
} {
  return { status: response.status, body: response._data };
}

async function call(
  label: string,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<void> {
  busy.value = true;
  failure.value = '';
  try {
    const { status, body } = await run();
    lastResponse.value = body;
    outcome.value = `${label} → ${status}`;
  } catch (error) {
    const { status, text } = describe(error);
    lastResponse.value = (error as { data?: unknown }).data ?? undefined;
    outcome.value = `${label} → ${status}`;
    failure.value = `${status} ${text}`;
  } finally {
    busy.value = false;
  }
}

async function start(): Promise<void> {
  await call('create', async () => {
    const result = received(
      await $fetch.raw<Configuration>('/api/configurations', {
        method: 'POST',
        body: { productId: productId.value, quantity: 1 },
      }),
    );
    if (result.body) config.value = result.body;
    return result;
  });
  // A 404 here is the switch: this page is only reachable with the feature on,
  // so the route that still answers 404 is one with no backend behind it. A
  // hand-typed `?product=` that matches no seed lands here too, which is why
  // the server's own message is shown next to it.
  backendOff.value = failure.value.startsWith('404');
}

// ---------------------------------------------------------------------------
// The verbs
// ---------------------------------------------------------------------------
function selectOption(optionId: string): ConfigurationChange {
  return {
    type: 'option',
    optionId,
    instanceId: '0',
    selected: true,
    quantity: 1,
    lock: 'none',
  };
}

const CHANGE_STEPS: { label: string; changes: ConfigurationChange[] }[] = [
  { label: 'legs = electric', changes: [selectOption('legs-electric')] },
  { label: 'top = steel', changes: [selectOption('top-steel')] },
  {
    label: 'width = 1800',
    changes: [{ type: 'variable', variableId: 'width', value: 1800 }],
  },
  { label: 'colour = RAL 9005', changes: [selectOption('ral-9005')] },
];

function currentId(): string {
  return config.value?.configurationId ?? '';
}

async function applyChanges(step: {
  label: string;
  changes: ConfigurationChange[];
}): Promise<void> {
  await call(step.label, async () => {
    const result = received(
      await $fetch.raw<Configuration>(
        `/api/configurations/${currentId()}/changes`,
        { method: 'POST', body: { changes: step.changes } },
      ),
    );
    if (result.body) config.value = result.body;
    return result;
  });
}

async function renew(): Promise<void> {
  await call('renew', async () => {
    const result = received(
      await $fetch.raw<{ expiresAt: string }>(
        `/api/configurations/${currentId()}/renew`,
        { method: 'POST' },
      ),
    );
    if (config.value && result.body) {
      config.value.expiresAt = result.body.expiresAt;
    }
    return result;
  });
}

async function commit(): Promise<void> {
  await call('commit', async () => {
    const result = received(
      await $fetch.raw<CommittedConfiguration>(
        `/api/configurations/${currentId()}/commit`,
        { method: 'POST' },
      ),
    );
    if (result.body) committed.value = result.body;
    finished.value = true;
    return result;
  });
}

async function release(): Promise<void> {
  await call('delete', async () => {
    const result = received(
      // The route answers a bare 204, so there is no body type to infer —
      // and leaving it to be inferred is what overflows the route types.
      await $fetch.raw<null>(`/api/configurations/${currentId()}`, {
        method: 'DELETE',
      }),
    );
    finished.value = true;
    return result;
  });
}

// ---------------------------------------------------------------------------
// The countdown
// ---------------------------------------------------------------------------
const now = ref(0);
const countdown = useIntervalFn(
  () => {
    now.value = Date.now();
  },
  1000,
  { immediate: false, immediateCallback: true },
);

const remaining = computed(() => {
  if (!config.value || !now.value) return '';
  const left = Date.parse(config.value.expiresAt) - now.value;
  if (left <= 0) return 'expired';
  const seconds = Math.floor(left / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
});

// A session must not be opened while the page renders on the server: the same
// POST would run again after hydration and every load would leak one.
onMounted(() => {
  void start();
  countdown.resume();
});

// ---------------------------------------------------------------------------
// The document, flattened
//
// One list rather than a recursive component: the nesting is the thing being
// shown, and a component for it is exactly what this page must not leave
// behind.
// ---------------------------------------------------------------------------
interface TreeRow {
  key: string;
  depth: number;
  kind: string;
  name: string;
  id: string;
  facts: string;
  messages: ConfigurationMessage[];
}

function money(value: PriceType): string {
  return `${exVatAmount(value)} ${currencyCode(value) ?? ''}`;
}

function shown(value: ConfigurationValue): string {
  return value === null ? 'null' : String(value);
}

function bounds(variable: ConfigurationVariable): string {
  const parts: string[] = [];
  if (variable.min !== undefined) parts.push(`min ${variable.min}`);
  if (variable.max !== undefined) parts.push(`max ${variable.max}`);
  if (variable.step !== undefined) parts.push(`step ${variable.step}`);
  return parts.join(' ');
}

function facts(parts: (string | false)[]): string {
  return parts.filter(Boolean).join(' · ');
}

function pushGroups(
  groups: ConfigurationOptionGroup[],
  depth: number,
  rows: TreeRow[],
): void {
  for (const group of groups) {
    rows.push({
      key: `group:${group.id}:${rows.length}`,
      depth,
      kind: 'group',
      name: group.name,
      id: group.id,
      facts: facts([
        `available ${group.available}`,
        group.minSelections !== undefined && `min ${group.minSelections}`,
        group.maxSelections !== undefined && `max ${group.maxSelections}`,
        group.quantityEditable && 'quantity editable',
      ]),
      messages: group.messages,
    });

    for (const option of group.options) {
      rows.push({
        key: `option:${option.id}:${rows.length}`,
        depth: depth + 1,
        kind: 'option',
        name: option.name,
        id: option.id,
        facts: facts([
          `selected ${option.selected}`,
          `available ${option.available}`,
          `selectionSource ${option.selectionSource}`,
          `quantity ${option.quantity}`,
          money(option.unitPrice),
        ]),
        messages: option.messages,
      });
    }

    pushGroups(group.optionGroups, depth + 1, rows);
  }
}

function pushSections(
  sections: ConfigurationSection[],
  depth: number,
  rows: TreeRow[],
): void {
  for (const section of sections) {
    rows.push({
      key: `section:${section.id}:${rows.length}`,
      depth,
      kind: 'section',
      name: section.name,
      id: section.id,
      facts: `visible ${section.visible}`,
      messages: section.messages,
    });

    for (const variable of section.variables) {
      rows.push({
        key: `variable:${variable.id}:${rows.length}`,
        depth: depth + 1,
        kind: 'variable',
        name: variable.name,
        id: variable.id,
        facts: facts([
          `value ${shown(variable.value)}${variable.unit ? ` ${variable.unit}` : ''}`,
          `available ${variable.available}`,
          `valueSource ${variable.valueSource}`,
          `selectionSource ${variable.selectionSource}`,
          bounds(variable),
        ]),
        messages: variable.messages,
      });
    }

    pushGroups(section.optionGroups, depth + 1, rows);
    pushSections(section.sections, depth + 1, rows);
  }
}

const rows = computed<TreeRow[]>(() => {
  const collected: TreeRow[] = [];
  if (config.value) pushSections(config.value.sections, 0, collected);
  return collected;
});

const raw = computed(() =>
  lastResponse.value === undefined
    ? '(no body)'
    : JSON.stringify(lastResponse.value, null, 2),
);
</script>

<template>
  <div class="space-y-6 p-6 font-mono text-xs">
    <header class="space-y-2">
      <h1 class="text-sm font-bold">Configurator preview</h1>
      <p>
        <span v-for="product in PRODUCTS" :key="product.productId" class="mr-4">
          <a class="underline" :href="`?product=${product.productId}`">{{
            product.label
          }}</a>
        </span>
      </p>
      <p>product {{ productId }}</p>
    </header>

    <p v-if="backendOff">
      The fixture backend is off in this environment. The server said:
      {{ failure }}
    </p>

    <template v-else-if="config">
      <dl class="flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <dt class="inline">isValid</dt>
          {{ config.isValid }}
        </div>
        <div>
          <dt class="inline">unitPrice</dt>
          {{ money(config.unitPrice) }}
        </div>
        <div>
          <dt class="inline">quantity</dt>
          {{ config.quantity }}
        </div>
        <div>
          <dt class="inline">expiresAt</dt>
          {{ config.expiresAt }} ({{ remaining }})
        </div>
        <div>
          <dt class="inline">configurationId</dt>
          {{ config.configurationId }}
        </div>
      </dl>

      <div class="space-y-2">
        <p>Canonical changes · KONF-1001</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="step in CHANGE_STEPS"
            :key="step.label"
            type="button"
            class="border px-2 py-1"
            :disabled="busy || finished"
            @click="applyChanges(step)"
          >
            {{ step.label }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="border px-2 py-1"
            :disabled="busy || finished"
            @click="renew"
          >
            renew
          </button>
          <button
            type="button"
            class="border px-2 py-1"
            :disabled="busy || finished"
            @click="commit"
          >
            commit
          </button>
          <button
            type="button"
            class="border px-2 py-1"
            :disabled="busy || finished"
            @click="release"
          >
            delete
          </button>
        </div>
        <p v-if="outcome">{{ outcome }}</p>
        <p v-if="failure">{{ failure }}</p>
        <p v-if="finished">
          The session is finished; every verb now answers 410.
        </p>
      </div>

      <div v-if="committed" class="space-y-1">
        <p>
          committed {{ committed.committedConfigurationId }} ·
          {{ money(committed.unitPrice) }} frozen
        </p>
        <p v-for="line in committed.summary" :key="line.label" class="pl-4">
          {{ line.label }} · {{ line.value
          }}<span v-if="line.price"> · {{ money(line.price) }}</span>
        </p>
      </div>

      <ul class="space-y-1">
        <li
          v-for="row in rows"
          :key="row.key"
          :style="{ paddingLeft: `${row.depth * 16}px` }"
        >
          <span
            >{{ row.kind }} {{ row.id }} · {{ row.name }} ·
            {{ row.facts }}</span
          >
          <span
            v-for="(message, index) in row.messages"
            :key="index"
            class="pl-2"
          >
            [{{ message.severity }}] {{ message.text }}
          </span>
        </li>
      </ul>

      <pre class="overflow-x-auto border p-2">{{ raw }}</pre>
    </template>

    <p v-else-if="failure">{{ failure }}</p>
    <p v-else>Starting a session…</p>
  </div>
</template>
