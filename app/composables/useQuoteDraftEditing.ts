import { computed, onScopeDispose, reactive, ref, shallowReactive } from 'vue';
import type {
  Quote,
  QuoteLineItem,
  QuoteRequestLine,
  QuoteRequestUpdate,
} from '#shared/types/quote';
import { QUOTE_LINE_MAX_QUANTITY } from '#shared/constants/quote';

/** Typing "240" or clicking + five times is one save. */
export const AMOUNT_SAVE_DELAY_MS = 400;
/** How long a removed line can be put back. */
export const UNDO_WINDOW_MS = 10_000;

export interface DraftNotice {
  kind: 'removed' | 'added';
  /** The product's name. */
  name: string;
  undo?: () => void;
}

interface Options {
  /** The draft as Geins last answered it. */
  quote: () => Quote;
  /** One write; null when it failed. */
  save: (update: QuoteRequestUpdate) => Promise<Quote | null>;
  onSaved: (quote: Quote) => void;
  /** Read the draft again; the next save waits for it and builds on it. */
  onFailed: () => Promise<void>;
}

/**
 * Editing a request draft's name and lines, each change saved on its own.
 *
 * Geins takes the lines as the whole new list, so saves run one at a time and
 * each one builds its list from the newest answer plus the changes still to be
 * sent. A removed line leaves the table at once but is only saved when its
 * undo window closes: undo then needs no write, and a configured line is never
 * sent back by its configuration after Geins dropped it.
 */
export function useQuoteDraftEditing({
  quote,
  save,
  onSaved,
  onFailed,
}: Options) {
  // ------------------------------------------------- changes still to be sent
  const amounts = reactive(new Map<string, number>());
  const removals = reactive(new Set<string>());
  const adds = reactive<{ skuId: number }[]>([]);
  const name = ref<string | null>(null);

  // Shallow: the timer handles stay as they are, the count drives `saving`.
  const amountTimers = shallowReactive(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  /** The removed line that undo can still put back. */
  const undoable = ref<QuoteLineItem | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  const notice = ref<DraftNotice | null>(null);
  const saved = ref(false);
  /** Saves queued or under way. */
  const queued = ref(0);
  let chain: Promise<void> = Promise.resolve();
  let failures = 0;

  const lines = computed<QuoteLineItem[]>(() =>
    quote()
      .lineItems.filter(
        (l) => !removals.has(l.id) && l.id !== undoable.value?.id,
      )
      .map((l) =>
        amounts.has(l.id) ? { ...l, quantity: amounts.get(l.id)! } : l,
      ),
  );

  /** A draft must keep one line; Geins refuses an empty list. */
  const canRemove = computed(() => lines.value.length > 1);

  /** Something is not in Geins yet: a save, an amount, a removal waiting. */
  const saving = computed(
    () => queued.value > 0 || amountTimers.size > 0 || undoable.value !== null,
  );

  // ------------------------------------------------------------------- saving
  function requestLine(l: QuoteLineItem, quantity: number): QuoteRequestLine {
    return {
      id: l.id,
      skuId: l.skuId,
      quantity,
      ...(l.configuration && {
        configurationId: l.configuration.configurationId,
      }),
      ...(l.message && { message: l.message }),
    };
  }

  /** The whole list as it should be, or null when Geins already holds it. */
  function buildItems(): QuoteRequestLine[] | null {
    let changed = adds.length > 0;
    const items: QuoteRequestLine[] = [];
    for (const l of quote().lineItems) {
      if (removals.has(l.id)) {
        changed = true;
        continue;
      }
      const quantity = amounts.get(l.id) ?? l.quantity;
      if (quantity !== l.quantity) changed = true;
      items.push(requestLine(l, quantity));
    }
    for (const { skuId } of adds) {
      const same = items.find(
        (item) => item.skuId === skuId && !item.configurationId,
      );
      if (same) {
        same.quantity = Math.min(same.quantity + 1, QUOTE_LINE_MAX_QUANTITY);
      } else {
        items.push({ skuId, quantity: 1 });
      }
    }
    return changed ? items : null;
  }

  /** Send what is waiting now, built on the newest answer. */
  async function runSave(): Promise<void> {
    const update: QuoteRequestUpdate = {};
    if (name.value !== null) update.name = name.value;
    const items = buildItems();
    if (items) update.items = items;
    if (!Object.keys(update).length) return;

    // What this save carries, so a change made meanwhile is not dropped with it.
    const sentAmounts = new Map(amounts);
    const sentRemovals = [...removals];
    const sentAdds = adds.length;
    const sentName = name.value;

    const answer = await save(update);

    for (const [id, quantity] of sentAmounts) {
      if (amounts.get(id) === quantity) amounts.delete(id);
    }
    for (const id of sentRemovals) removals.delete(id);
    adds.splice(0, sentAdds);
    if (name.value === sentName) name.value = null;

    if (!answer) {
      failures++;
      await onFailed();
      return;
    }
    saved.value = true;
    onSaved(answer);
  }

  /** Queue a save after the ones before it. */
  function enqueue(): Promise<void> {
    queued.value++;
    // Never rejects: one save going wrong must not stop the ones after it.
    chain = chain
      .then(runSave)
      .catch(() => {
        failures++;
      })
      .finally(() => {
        queued.value--;
      });
    return chain;
  }

  // ------------------------------------------------------------------ notice
  function closeNotice() {
    clearTimeout(undoTimer);
    notice.value = null;
  }

  /** The removal waiting for undo goes to Geins with the next save. */
  function commitRemoval() {
    if (undoable.value) removals.add(undoable.value.id);
    undoable.value = null;
  }

  /** …and that save goes now. */
  function saveRemoval() {
    if (!undoable.value) return;
    commitRemoval();
    void enqueue();
  }

  function showNotice(next: DraftNotice) {
    clearTimeout(undoTimer);
    notice.value = next;
    undoTimer = setTimeout(() => {
      notice.value = null;
      saveRemoval();
    }, UNDO_WINDOW_MS);
  }

  // ----------------------------------------------------------------- actions
  function setQuantity(l: QuoteLineItem, quantity: number) {
    amounts.set(l.id, quantity);
    clearTimeout(amountTimers.get(l.id));
    amountTimers.set(
      l.id,
      setTimeout(() => {
        amountTimers.delete(l.id);
        void enqueue();
      }, AMOUNT_SAVE_DELAY_MS),
    );
  }

  function remove(l: QuoteLineItem) {
    if (!canRemove.value) return;
    // An earlier removal can no longer be undone once this one takes the notice.
    saveRemoval();
    undoable.value = l;
    showNotice({
      kind: 'removed',
      name: l.name,
      undo: () => {
        undoable.value = null;
        closeNotice();
      },
    });
  }

  function add(product: { skuId: number; name: string }) {
    commitRemoval();
    adds.push({ skuId: product.skuId });
    void enqueue();
    showNotice({ kind: 'added', name: product.name });
  }

  function rename(next: string) {
    name.value = next;
    void enqueue();
  }

  /**
   * Send everything still waiting, now, and wait for the saves under way;
   * false when one of them failed.
   */
  async function flush(): Promise<boolean> {
    closeNotice();
    commitRemoval();
    for (const timer of amountTimers.values()) clearTimeout(timer);
    amountTimers.clear();
    const before = failures;
    await enqueue();
    return failures === before;
  }

  onScopeDispose(() => {
    clearTimeout(undoTimer);
    for (const timer of amountTimers.values()) clearTimeout(timer);
  });

  return {
    lines,
    notice,
    saving,
    saved,
    canRemove,
    setQuantity,
    remove,
    add,
    rename,
    flush,
  };
}
