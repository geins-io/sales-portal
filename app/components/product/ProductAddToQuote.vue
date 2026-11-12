<script setup lang="ts">
/**
 * "Add to quote request" under add to cart: a menu of the buyer's request
 * drafts, most recently changed first, then a new request named in a dialog.
 * The page says how a line is sent. The buyer stays on the page, and a notice
 * says where the line landed.
 */
import { ChevronDown, FileText, Loader2, Plus } from 'lucide-vue-next';
import type { Quote, QuoteAddTarget, QuoteListItem } from '#shared/types/quote';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useQuotesStore, type QuoteAddOutcome } from '~/stores/quotes';
import { internalFetch } from '~/utils/internal-fetch';

const props = defineProps<{
  /** Adds the line; rejects when it did not land. */
  send: (target: QuoteAddTarget) => Promise<Pick<Quote, 'id' | 'name'>>;
  disabled?: boolean;
  /** The line still needs a choice, such as a variant: the page asks for it. */
  needsChoice?: boolean;
  /**
   * The page the notice belongs to. A page that takes the menu off and puts it
   * back passes its own, so the notice outlives the menu.
   */
  scope?: string;
}>();

const emit = defineEmits<{ choose: [] }>();

const { t } = useI18n();
const quotes = useQuotesStore();
const { canRequestQuotes } = useFeatureAccess();

const show = computed(() => canRequestQuotes());

const menuOpen = ref(false);
const drafts = ref<QuoteListItem[]>([]);
const loading = ref(false);
const loadFailed = ref(false);
const working = ref(false);
const naming = ref(false);

const ownScope = useId();
const scope = computed(() => props.scope ?? ownScope);
const outcome = computed(() =>
  quotes.lastAdd?.scope === scope.value ? quotes.lastAdd.outcome : null,
);
/** Where the last add landed. */
const last = computed(() =>
  outcome.value?.kind === 'added' ? outcome.value : null,
);
const failed = computed(() => outcome.value?.kind === 'failed');

function settle(next: QuoteAddOutcome | null, at: string) {
  quotes.lastAdd = next ? { scope: at, outcome: next } : null;
}

const changedAt = (quote: QuoteListItem) => Date.parse(quote.updatedAt) || 0;

async function loadDrafts() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const { quotes } = await internalFetch<{ quotes: QuoteListItem[] }>(
      '/api/quotes',
    );
    drafts.value = quotes
      .filter((quote) => quote.status === 'request_draft')
      .sort((a, b) => changedAt(b) - changedAt(a));
  } catch {
    drafts.value = [];
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

function onOpen(open: boolean) {
  if (open && (props.disabled || working.value)) return;
  if (open && props.needsChoice) {
    emit('choose');
    return;
  }
  menuOpen.value = open;
  if (open) void loadDrafts();
}

async function add(target: QuoteAddTarget): Promise<boolean> {
  if (working.value) return false;
  // Read now: the menu may be gone by the time the add answers.
  const at = scope.value;
  working.value = true;
  settle(null, at);
  try {
    const quote = await props.send(target);
    settle(
      {
        kind: 'added',
        id: quote.id,
        name: quote.name ?? '',
        created: 'name' in target,
      },
      at,
    );
    return true;
  } catch {
    settle({ kind: 'failed' }, at);
    return false;
  } finally {
    working.value = false;
  }
}

function startNew() {
  if (failed.value) settle(null, scope.value);
  naming.value = true;
}

async function createWith(name: string) {
  if (await add({ name })) naming.value = false;
}
</script>

<template>
  <div v-if="show" class="space-y-2">
    <DropdownMenu :open="menuOpen" @update:open="onOpen">
      <DropdownMenuTrigger as-child>
        <Button
          variant="outline"
          class="h-9 w-full gap-2 shadow-none"
          data-testid="add-to-quote-button"
          :disabled="disabled || working"
        >
          <Loader2 v-if="working" class="size-4 animate-spin" />
          <FileText v-else class="size-4" />
          {{ t('product.add_to_quote') }}
          <ChevronDown class="ml-auto size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        class="w-(--reka-dropdown-menu-trigger-width)"
        data-testid="add-to-quote-menu"
      >
        <DropdownMenuLabel class="text-muted-foreground text-xs font-normal">
          {{ t('product.quote_menu.label') }}
        </DropdownMenuLabel>
        <DropdownMenuItem v-if="loading" disabled>
          {{ t('common.loading') }}
        </DropdownMenuItem>
        <template v-else>
          <DropdownMenuItem
            v-for="draft in drafts"
            :key="draft.id"
            data-testid="add-to-quote-draft"
            @select="add({ quoteId: draft.id })"
          >
            <span class="min-w-0 flex-1 truncate">{{ draft.name }}</span>
            <span class="text-muted-foreground shrink-0 text-xs tabular-nums">
              {{ t('product.quote_menu.items', { count: draft.itemCount }) }}
            </span>
          </DropdownMenuItem>
          <p
            v-if="loadFailed"
            class="text-muted-foreground px-2 py-1.5 text-sm"
            data-testid="add-to-quote-load-failed"
          >
            {{ t('product.quote_menu.load_failed') }}
          </p>
          <p
            v-else-if="!drafts.length"
            class="text-muted-foreground px-2 py-1.5 text-sm"
            data-testid="add-to-quote-empty"
          >
            {{ t('product.quote_menu.no_drafts') }}
          </p>
        </template>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="add-to-quote-new" @select="startNew">
          <Plus class="size-4" />
          {{ t('product.quote_menu.new_request') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <ProductQuoteAddedNotice
      v-if="last"
      :quote-id="last.id"
      :name="last.name"
      :created="last.created"
    />

    <p
      v-if="failed && !naming"
      role="alert"
      class="text-danger text-sm"
      data-testid="add-to-quote-error"
    >
      {{ t('product.quote_menu.failed') }}
    </p>

    <PortalDialogRenameQuoteDraft
      v-model:open="naming"
      mode="new"
      :pending="working"
      :error="failed ? t('product.quote_menu.failed') : null"
      @submit="createWith"
    />
  </div>
</template>
