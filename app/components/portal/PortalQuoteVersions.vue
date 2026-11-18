<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { getQuoteStatusLabelKey } from '~/utils/quote-status';
import { quoteVersionLabel } from '~/utils/quote-view';
import type { QuoteVersion } from '#shared/types/quote';
import { versionNames } from '#shared/utils/quote-versions';

const props = defineProps<{
  /** Newest first, as `revisions` lists them. */
  versions: QuoteVersion[];
  /** The version open on the page. */
  currentId: string;
  /** When the buyer sent the request; the request has no `validFrom`. */
  requestSentAt?: string;
}>();

const emit = defineEmits<{ select: [id: string] }>();

const { t } = useI18n();
const { formatLocale } = useFormatLocale();
const { timezone } = useTenant();

const names = computed(() => versionNames(props.versions));
const latestId = computed(() => props.versions[0]?.quotationId);
const current = computed(() =>
  props.versions.find((v) => v.quotationId === props.currentId),
);

const isRequest = (v: QuoteVersion) =>
  names.value.get(v.quotationId)?.kind === 'request';

const label = (v: QuoteVersion) =>
  quoteVersionLabel(names.value.get(v.quotationId), t);

function state(v: QuoteVersion): string {
  if (isRequest(v)) return t('portal.quotations.revisions.request_sent');
  return v.quotationId === latestId.value
    ? t('portal.quotations.revisions.latest')
    : t(getQuoteStatusLabelKey(v.status));
}

function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(formatLocale.value, {
    ...(timezone.value ? { timeZone: timezone.value } : {}),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** State, sent date and, on the newest, how long it is valid. */
function detail(v: QuoteVersion): string {
  const sent = shortDate(isRequest(v) ? props.requestSentAt : v.validFrom);
  const valid =
    v.quotationId === latestId.value && v.validTo
      ? t('portal.quotations.revisions.valid_to', {
          date: shortDate(v.validTo),
        })
      : '';
  return [state(v), sent, valid].filter(Boolean).join(' · ');
}

/** An offer without a number to show reads by its state alone. */
const triggerText = computed(() => {
  const v = current.value;
  if (!v) return '';
  return isRequest(v)
    ? label(v)
    : [label(v), state(v)].filter(Boolean).join(' · ');
});

function pick(id: unknown) {
  if (typeof id === 'string' && id !== props.currentId) emit('select', id);
}
</script>

<template>
  <Select :model-value="currentId" @update:model-value="pick">
    <SelectTrigger
      size="sm"
      class="shadow-none"
      data-testid="quote-revision-select"
      :aria-label="t('portal.quotations.revisions.select_label')"
    >
      <span class="text-muted-foreground"
        >{{ t('portal.quotations.revisions.label') }}:</span
      >
      <SelectValue>{{ triggerText }}</SelectValue>
    </SelectTrigger>
    <SelectContent align="end">
      <SelectItem
        v-for="v in versions"
        :key="v.quotationId"
        :value="v.quotationId"
        :data-testid="`quote-version-${v.quotationId}`"
      >
        <template v-if="label(v)">{{ `${label(v)} ` }}</template>
        <span class="text-muted-foreground text-xs">{{ detail(v) }}</span>
      </SelectItem>
    </SelectContent>
  </Select>
</template>
