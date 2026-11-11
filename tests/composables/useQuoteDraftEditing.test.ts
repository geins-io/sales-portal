import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, ref, type EffectScope } from 'vue';
import type {
  Quote,
  QuoteLineItem,
  QuoteRequestUpdate,
} from '#shared/types/quote';
import { makeQuote } from '../fixtures/quote';
import {
  AMOUNT_SAVE_DELAY_MS,
  UNDO_WINDOW_MS,
  useQuoteDraftEditing,
} from '../../app/composables/useQuoteDraftEditing';

function line(
  id: string,
  skuId: number,
  quantity: number,
  extra: Partial<QuoteLineItem> = {},
): QuoteLineItem {
  const [base] = makeQuote().lineItems;
  return { ...base!, id, skuId, quantity, name: `Product ${skuId}`, ...extra };
}

const configured = line('line-c', 900, 2, {
  configuration: {
    configurationId: 'cfg-1',
    summary: [{ label: 'Panel', value: '55"' }],
    sections: [],
  },
});

function draftWith(lines: QuoteLineItem[]): Quote {
  return makeQuote({
    id: 'draft-1',
    status: 'request_draft',
    lineItems: lines,
  });
}

/** A save the test answers when it chooses. */
function deferred() {
  let resolve!: (quote: Quote | null) => void;
  const promise = new Promise<Quote | null>((r) => (resolve = r));
  return { promise, resolve };
}

let scope: EffectScope;
let quote: ReturnType<typeof ref<Quote>>;
let save: ReturnType<
  typeof vi.fn<(update: QuoteRequestUpdate) => Promise<Quote | null>>
>;
let onSaved: ReturnType<typeof vi.fn<(q: Quote) => void>>;
let onFailed: ReturnType<typeof vi.fn<() => Promise<void>>>;

/** Geins as the save sees it: it answers the draft with the lines it was sent. */
function geinsAnswers() {
  save.mockImplementation(async (update) => {
    const current = quote.value!;
    const lineItems = update.items
      ? update.items.map((item, i) => {
          const kept = current.lineItems.find((l) => l.id === item.id);
          return kept
            ? { ...kept, quantity: item.quantity }
            : line(`new-${i}-${item.skuId}`, item.skuId, item.quantity);
        })
      : current.lineItems;
    return { ...current, name: update.name ?? current.name, lineItems };
  });
}

function setup(lines: QuoteLineItem[]) {
  quote = ref<Quote>(draftWith(lines));
  save = vi.fn();
  onSaved = vi.fn((q: Quote) => {
    quote.value = q;
  });
  onFailed = vi.fn(async () => {});
  scope = effectScope();
  return scope.run(() =>
    useQuoteDraftEditing({
      quote: () => quote.value!,
      save,
      onSaved,
      onFailed,
    }),
  )!;
}

const ids = (lines: QuoteLineItem[]) => lines.map((l) => l.id);
const sent = (call = 0) => save.mock.calls[call]![0];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});

describe('useQuoteDraftEditing', () => {
  describe('amounts', () => {
    it('shows a new amount at once and saves the last one once, after a pause', async () => {
      const editing = setup([line('line-a', 11, 2), line('line-b', 12, 1)]);
      geinsAnswers();

      editing.setQuantity(editing.lines.value[0]!, 3);
      editing.setQuantity(editing.lines.value[0]!, 4);

      expect(editing.lines.value[0]!.quantity).toBe(4);
      expect(editing.saving.value).toBe(true);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS - 1);
      expect(save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(save).toHaveBeenCalledTimes(1);
      expect(sent()).toEqual({
        items: [
          { id: 'line-a', skuId: 11, quantity: 4 },
          { id: 'line-b', skuId: 12, quantity: 1 },
        ],
      });
      expect(editing.lines.value[0]!.quantity).toBe(4);
      expect(editing.saving.value).toBe(false);
      expect(editing.saved.value).toBe(true);
    });

    it('waits for a pause in the changes, however long they go on', async () => {
      const editing = setup([line('line-a', 11, 2)]);
      geinsAnswers();

      editing.setQuantity(editing.lines.value[0]!, 3);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS - 100);
      editing.setQuantity(editing.lines.value[0]!, 4);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS - 1);
      expect(save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(save).toHaveBeenCalledTimes(1);
      expect(sent().items![0]!.quantity).toBe(4);
    });

    it('keeps an amount typed while its line is being saved, and saves it next', async () => {
      const editing = setup([line('line-a', 11, 2)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);

      editing.setQuantity(editing.lines.value[0]!, 3);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);
      expect(editing.lines.value[0]!.quantity).toBe(3);
      editing.setQuantity(editing.lines.value[0]!, 4);
      geinsAnswers();
      first.resolve({
        ...quote.value!,
        lineItems: [line('line-a', 11, 3)],
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(editing.lines.value[0]!.quantity).toBe(4);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);
      expect(save).toHaveBeenCalledTimes(2);
      expect(sent(1).items![0]!.quantity).toBe(4);
    });

    it('saves nothing when the amount goes back to what Geins holds', async () => {
      const editing = setup([line('line-a', 11, 2)]);

      editing.setQuantity(editing.lines.value[0]!, 3);
      editing.setQuantity(editing.lines.value[0]!, 2);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);

      expect(save).not.toHaveBeenCalled();
      expect(editing.saving.value).toBe(false);
    });

    it('saves a configured line at its new amount, with its configuration, as a plain one', async () => {
      const editing = setup([configured, line('line-a', 11, 1)]);

      editing.setQuantity(configured, 5);
      expect(editing.lines.value[0]!.quantity).toBe(5);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS - 1);
      expect(save).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(save).toHaveBeenCalledOnce();
      expect(save.mock.calls[0]![0].items).toEqual([
        { id: 'line-c', skuId: 900, quantity: 5, configurationId: 'cfg-1' },
        { id: 'line-a', skuId: 11, quantity: 1 },
      ]);
    });
  });

  describe('the whole list', () => {
    it('sends every line: a kept line by id, a configured one with its configuration, a message as it was', async () => {
      const editing = setup([
        line('line-a', 11, 2, { message: 'Montering' }),
        configured,
      ]);
      geinsAnswers();

      editing.setQuantity(editing.lines.value[0]!, 3);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);

      expect(sent()).toEqual({
        items: [
          { id: 'line-a', skuId: 11, quantity: 3, message: 'Montering' },
          { id: 'line-c', skuId: 900, quantity: 2, configurationId: 'cfg-1' },
        ],
      });
    });

    it('runs one save at a time, and builds the next from the answer to the one before', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);

      editing.add({ skuId: 13, name: 'Product 13' });
      await vi.advanceTimersByTimeAsync(0);
      expect(save).toHaveBeenCalledTimes(1);

      editing.setQuantity(editing.lines.value[1]!, 7);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);
      // The amount waits for the add to be answered.
      expect(save).toHaveBeenCalledTimes(1);

      geinsAnswers();
      first.resolve({
        ...quote.value!,
        lineItems: [...quote.value!.lineItems, line('line-new', 13, 1)],
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(save).toHaveBeenCalledTimes(2);
      expect(sent(1)).toEqual({
        items: [
          { id: 'line-a', skuId: 11, quantity: 1 },
          { id: 'line-b', skuId: 12, quantity: 7 },
          { id: 'line-new', skuId: 13, quantity: 1 },
        ],
      });
    });

    it('folds the changes made while a save runs into one next save', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);

      editing.add({ skuId: 13, name: 'Product 13' });
      await vi.advanceTimersByTimeAsync(0);
      editing.add({ skuId: 14, name: 'Product 14' });
      editing.add({ skuId: 15, name: 'Product 15' });
      geinsAnswers();
      first.resolve(quote.value!);
      await vi.advanceTimersByTimeAsync(0);

      expect(save).toHaveBeenCalledTimes(2);
      expect(sent(1).items!.map((i) => i.skuId)).toEqual([11, 12, 14, 15]);
    });
  });

  describe('removing a line', () => {
    it('takes the line away at once and saves the removal when the undo window closes', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      geinsAnswers();

      editing.remove(editing.lines.value[0]!);

      expect(ids(editing.lines.value)).toEqual(['line-b']);
      expect(editing.notice.value).toMatchObject({
        kind: 'removed',
        name: 'Product 11',
      });
      expect(editing.notice.value!.undo).toBeTypeOf('function');
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
      expect(save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(sent()).toEqual({
        items: [{ id: 'line-b', skuId: 12, quantity: 1 }],
      });
      expect(editing.notice.value).toBeNull();
      expect(ids(editing.lines.value)).toEqual(['line-b']);
    });

    it('is not saved while it waits for undo', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      geinsAnswers();
      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);
      expect(editing.saving.value).toBe(false);

      editing.remove(editing.lines.value[0]!);
      expect(editing.saving.value).toBe(true);

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      expect(editing.saving.value).toBe(false);
    });

    it('is not waiting any more once undone', () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);

      editing.remove(editing.lines.value[0]!);
      editing.notice.value!.undo!();

      expect(editing.saving.value).toBe(false);
    });

    it('puts the line back on undo and saves nothing', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);

      editing.remove(editing.lines.value[0]!);
      editing.notice.value!.undo!();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(ids(editing.lines.value)).toEqual(['line-a', 'line-b']);
      expect(editing.notice.value).toBeNull();
      expect(save).not.toHaveBeenCalled();
    });

    it('keeps a line waiting to be removed in the saves made meanwhile', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      geinsAnswers();

      editing.remove(editing.lines.value[0]!);
      editing.setQuantity(editing.lines.value[0]!, 4);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);

      expect(sent()).toEqual({
        items: [
          { id: 'line-a', skuId: 11, quantity: 1 },
          { id: 'line-b', skuId: 12, quantity: 4 },
        ],
      });
      expect(ids(editing.lines.value)).toEqual(['line-b']);
      editing.notice.value!.undo!();
      expect(ids(editing.lines.value)).toEqual(['line-a', 'line-b']);
    });

    it('removes a configured line the same way, never sending its configuration again', async () => {
      const editing = setup([configured, line('line-a', 11, 1)]);
      geinsAnswers();

      editing.remove(configured);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(sent()).toEqual({
        items: [{ id: 'line-a', skuId: 11, quantity: 1 }],
      });
    });

    it('saves an earlier removal at once when a second line is removed', async () => {
      const editing = setup([
        line('line-a', 11, 1),
        line('line-b', 12, 1),
        line('line-c', 13, 1),
      ]);
      geinsAnswers();

      editing.remove(editing.lines.value[0]!);
      editing.remove(editing.lines.value[0]!);
      await vi.advanceTimersByTimeAsync(0);

      expect(save).toHaveBeenCalledTimes(1);
      expect(sent().items!.map((i) => i.id)).toEqual(['line-b', 'line-c']);
      expect(ids(editing.lines.value)).toEqual(['line-c']);
      expect(editing.notice.value).toMatchObject({ name: 'Product 12' });
    });

    it('gives a later removal its own undo window', async () => {
      const editing = setup([
        line('line-a', 11, 1),
        line('line-b', 12, 1),
        line('line-c', 13, 1),
      ]);
      geinsAnswers();

      editing.remove(editing.lines.value[0]!);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS / 2);
      editing.remove(editing.lines.value[0]!);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS / 2);

      // The first window's end does not close the second.
      expect(editing.notice.value).toMatchObject({ name: 'Product 12' });
      expect(save).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS / 2);
      expect(save).toHaveBeenCalledTimes(2);
      expect(sent(1).items!.map((i) => i.id)).toEqual(['line-c']);
    });

    it('keeps the last line: a draft must hold one', () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      expect(editing.canRemove.value).toBe(true);

      editing.remove(editing.lines.value[0]!);

      expect(editing.canRemove.value).toBe(false);
      editing.remove(editing.lines.value[0]!);
      expect(ids(editing.lines.value)).toEqual(['line-b']);
    });
  });

  describe('quick add', () => {
    it('adds a new product as a line of 1, at once, and says so', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      geinsAnswers();

      editing.add({ skuId: 13, name: 'Product 13' });
      await vi.advanceTimersByTimeAsync(0);

      expect(sent()).toEqual({
        items: [
          { id: 'line-a', skuId: 11, quantity: 1 },
          { skuId: 13, quantity: 1 },
        ],
      });
      expect(editing.notice.value).toEqual({
        kind: 'added',
        name: 'Product 13',
      });
    });

    it('adds one to the line of a product already on the draft', async () => {
      const editing = setup([line('line-a', 11, 2)]);
      geinsAnswers();

      editing.add({ skuId: 11, name: 'Product 11' });
      await vi.advanceTimersByTimeAsync(0);

      expect(sent()).toEqual({
        items: [{ id: 'line-a', skuId: 11, quantity: 3 }],
      });
    });

    it('adds a line of its own beside a configured line of the same SKU', async () => {
      const editing = setup([configured]);
      geinsAnswers();

      editing.add({ skuId: 900, name: 'Product 900' });
      await vi.advanceTimersByTimeAsync(0);

      expect(sent().items).toEqual([
        { id: 'line-c', skuId: 900, quantity: 2, configurationId: 'cfg-1' },
        { skuId: 900, quantity: 1 },
      ]);
    });

    it('saves a removal waiting for undo when the add takes the notice', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      geinsAnswers();

      editing.remove(editing.lines.value[0]!);
      editing.add({ skuId: 13, name: 'Product 13' });
      await vi.advanceTimersByTimeAsync(0);

      expect(save).toHaveBeenCalledTimes(1);
      expect(sent().items!.map((i) => i.skuId)).toEqual([12, 13]);
    });
  });

  describe('renaming', () => {
    it('is saving until Geins answers', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);

      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);
      expect(editing.saving.value).toBe(true);

      first.resolve({ ...quote.value!, name: 'Ny' });
      await vi.advanceTimersByTimeAsync(0);
      expect(editing.saving.value).toBe(false);
    });

    it('saves a name typed while the one before is being saved', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);

      editing.rename('Första');
      await vi.advanceTimersByTimeAsync(0);
      editing.rename('Andra');
      geinsAnswers();
      first.resolve({ ...quote.value!, name: 'Första' });
      await vi.advanceTimersByTimeAsync(0);

      expect(save).toHaveBeenCalledTimes(2);
      expect(sent(1)).toEqual({ name: 'Andra' });
      expect(quote.value!.name).toBe('Andra');
    });

    it('sends only the name', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      geinsAnswers();

      editing.rename('Kontor plan 3');
      await vi.advanceTimersByTimeAsync(0);

      expect(sent()).toEqual({ name: 'Kontor plan 3' });
      expect(quote.value!.name).toBe('Kontor plan 3');
    });
  });

  describe('flush', () => {
    it('saves a removal waiting for undo and a waiting amount at once', async () => {
      const editing = setup([
        line('line-a', 11, 1),
        line('line-b', 12, 1),
        line('line-c', 13, 1),
      ]);
      geinsAnswers();

      editing.remove(editing.lines.value[0]!);
      editing.setQuantity(editing.lines.value[0]!, 6);
      const ok = await editing.flush();

      expect(ok).toBe(true);
      expect(save).toHaveBeenCalledTimes(1);
      expect(sent()).toEqual({
        items: [
          { id: 'line-b', skuId: 12, quantity: 6 },
          { id: 'line-c', skuId: 13, quantity: 1 },
        ],
      });
      expect(editing.notice.value).toBeNull();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('waits for a save under way', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);
      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);

      let done = false;
      const flushed = editing.flush().then((ok) => (done = ok));
      await vi.advanceTimersByTimeAsync(0);
      expect(done).toBe(false);

      first.resolve({ ...quote.value!, name: 'Ny' });
      await flushed;
      expect(done).toBe(true);
    });

    it('answers false when the save under way fails', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);
      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);

      const flushed = editing.flush();
      first.resolve(null);

      expect(await flushed).toBe(false);
    });

    it('answers true after an earlier save failed, with nothing waiting now', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      save.mockResolvedValueOnce(null);
      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);

      expect(await editing.flush()).toBe(true);
    });

    it('is done saving once it has sent what waited', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      geinsAnswers();

      editing.setQuantity(editing.lines.value[0]!, 5);
      await editing.flush();

      expect(editing.saving.value).toBe(false);
    });

    it('answers true with nothing to save', async () => {
      const editing = setup([line('line-a', 11, 1)]);

      expect(await editing.flush()).toBe(true);
      expect(save).not.toHaveBeenCalled();
    });

    it('answers false when a save fails', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      save.mockResolvedValue(null);

      editing.remove(editing.lines.value[0]!);

      expect(await editing.flush()).toBe(false);
    });
  });

  describe('a failed save', () => {
    it('drops what it sent, so the lines show what Geins holds, and says so', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      save.mockResolvedValue(null);

      editing.setQuantity(editing.lines.value[0]!, 9);
      editing.add({ skuId: 13, name: 'Product 13' });
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);

      expect(onFailed).toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalledTimes(1);
      expect(editing.lines.value.map((l) => l.quantity)).toEqual([1, 1]);
      expect(editing.saving.value).toBe(false);
      expect(editing.saved.value).toBe(false);
    });

    it('moves on once a save that got no answer gives up', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      const stuck = deferred();
      save.mockReturnValueOnce(stuck.promise);
      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);
      editing.setQuantity(editing.lines.value[1]!, 4);
      await vi.advanceTimersByTimeAsync(AMOUNT_SAVE_DELAY_MS);
      const leaving = editing.flush();
      expect(save).toHaveBeenCalledTimes(1);

      // The store answers null when its wait limit runs out.
      geinsAnswers();
      stuck.resolve(null);

      expect(await leaving).toBe(false);
      expect(onFailed).toHaveBeenCalled();
      expect(sent(1).items![1]!.quantity).toBe(4);
      expect(editing.saving.value).toBe(false);
      expect(await editing.flush()).toBe(true);
    });

    it('keeps the queue going when a save throws', async () => {
      const editing = setup([line('line-a', 11, 1)]);
      geinsAnswers();
      save.mockRejectedValueOnce(new Error('unexpected'));

      // The throw counts as a failure, though the flush's own save works.
      editing.rename('Ny');
      expect(await editing.flush()).toBe(false);

      editing.rename('Nyare');
      expect(await editing.flush()).toBe(true);
      expect(save.mock.calls.at(-1)![0]).toEqual({ name: 'Nyare' });
    });

    it('brings back a line whose removal failed', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      save.mockResolvedValue(null);

      editing.remove(editing.lines.value[0]!);
      await editing.flush();

      expect(ids(editing.lines.value)).toEqual(['line-a', 'line-b']);
    });

    it('builds the next save on the draft read again after a failure', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      let reread!: () => void;
      onFailed.mockImplementationOnce(
        () =>
          new Promise<void>((done) => {
            reread = () => {
              // Geins holds line-a at 7 after all, and line-b no more.
              quote.value = draftWith([line('line-a', 11, 7)]);
              done();
            };
          }),
      );
      save.mockResolvedValueOnce(null);

      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);
      editing.add({ skuId: 13, name: 'Product 13' });
      await vi.advanceTimersByTimeAsync(0);
      // The next save waits for the read.
      expect(save).toHaveBeenCalledTimes(1);

      geinsAnswers();
      reread();
      await vi.advanceTimersByTimeAsync(0);

      expect(save).toHaveBeenCalledTimes(2);
      expect(sent(1).items).toEqual([
        { id: 'line-a', skuId: 11, quantity: 7 },
        { skuId: 13, quantity: 1 },
      ]);
    });

    it('does not undo a later change the failed save never carried', async () => {
      const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);
      const first = deferred();
      save.mockReturnValueOnce(first.promise);

      editing.rename('Ny');
      await vi.advanceTimersByTimeAsync(0);
      editing.setQuantity(editing.lines.value[1]!, 5);
      first.resolve(null);
      await vi.advanceTimersByTimeAsync(0);

      expect(editing.lines.value[1]!.quantity).toBe(5);
    });
  });

  it('stops its timers when the view goes', async () => {
    const editing = setup([line('line-a', 11, 1), line('line-b', 12, 1)]);

    editing.remove(editing.lines.value[0]!);
    editing.setQuantity(editing.lines.value[0]!, 3);
    scope.stop();
    await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

    expect(save).not.toHaveBeenCalled();
  });
});
