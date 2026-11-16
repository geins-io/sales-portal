import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import { internalFetch } from '../../../app/utils/internal-fetch';

vi.mock('../../../app/utils/internal-fetch', () => ({
  internalFetch: vi.fn(),
}));

// `t` shows the values it is given, so an interpolation can be read.
vi.mock('vue-i18n', async () => {
  const { ref } = await import('vue');
  return {
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key} ${JSON.stringify(params)}` : key,
      locale: ref('en'),
    }),
  };
});

const { default: PortalQuoteThreadComposer } =
  await import('../../../app/components/portal/PortalQuoteThreadComposer.vue');

const fetchMock = vi.mocked(internalFetch);

const PARENT = {
  id: '3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f',
  name: 'Erik Sälj',
  text: 'Vi kan leverera i december.',
};

function mountComposer(replyTo: typeof PARENT | null = null) {
  return mountComponent(PortalQuoteThreadComposer, {
    props: { quoteId: 'q 1', replyTo },
  });
}

type Wrapper = ReturnType<typeof mountComposer>;

const input = (w: Wrapper) => w.find('[data-testid="quote-thread-input"]');
const sendButton = (w: Wrapper) => w.find('[data-testid="quote-thread-send"]');
const isDisabled = (w: Wrapper) =>
  sendButton(w).attributes('disabled') !== undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ message: { id: 'm-9' } });
});

describe('PortalQuoteThreadComposer', () => {
  it('shows the field, the button and the hint, as in the prototype', () => {
    const wrapper = mountComposer();

    expect(input(wrapper).attributes('placeholder')).toBe(
      'portal.quotations.thread.placeholder',
    );
    expect(input(wrapper).attributes('aria-label')).toBe(
      'portal.quotations.thread.placeholder',
    );
    // No maxlength: it would cut a pasted text without a word.
    expect(input(wrapper).attributes('maxlength')).toBeUndefined();
    expect(sendButton(wrapper).text()).toBe('portal.quotations.thread.send');
    expect(wrapper.find('[data-testid="quote-thread-hint"]').text()).toBe(
      'portal.quotations.thread.hint',
    );
  });

  it.each([
    ['empty', ''],
    ['only spaces and line breaks', '  \n  '],
  ])('cannot send a field that is %s', async (_label, text) => {
    const wrapper = mountComposer();
    await input(wrapper).setValue(text);

    expect(isDisabled(wrapper)).toBe(true);
    await input(wrapper).trigger('keydown', { key: 'Enter', metaKey: true });
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends 4000 characters, and not one more, saying how far over it is', async () => {
    const wrapper = mountComposer();
    await input(wrapper).setValue('x'.repeat(4000));
    expect(isDisabled(wrapper)).toBe(false);
    expect(wrapper.find('[data-testid="quote-thread-too-long"]').exists()).toBe(
      false,
    );

    await input(wrapper).setValue('x'.repeat(4012));

    expect(isDisabled(wrapper)).toBe(true);
    expect(wrapper.find('[data-testid="quote-thread-too-long"]').text()).toBe(
      'portal.quotations.thread.too_long {"count":4012,"max":4000}',
    );
    expect(wrapper.find('[data-testid="quote-thread-hint"]').exists()).toBe(
      false,
    );
    await input(wrapper).trigger('keydown', { key: 'Enter', ctrlKey: true });
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the trimmed text, then empties the field and says it was sent', async () => {
    const wrapper = mountComposer();
    await input(wrapper).setValue('  Går det att leverera i gult?\n');

    await sendButton(wrapper).trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/quotes/q%201/messages', {
      method: 'POST',
      body: { message: 'Går det att leverera i gult?' },
    });
    expect((input(wrapper).element as HTMLTextAreaElement).value).toBe('');
    expect(wrapper.emitted('sent')).toHaveLength(1);
    expect(wrapper.emitted('failed')).toBeUndefined();
  });

  it.each([
    ['⌘', { metaKey: true }],
    ['Ctrl', { ctrlKey: true }],
  ])('%s + Enter sends', async (_label, modifier) => {
    const wrapper = mountComposer();
    await input(wrapper).setValue('Hej');

    await input(wrapper).trigger('keydown', { key: 'Enter', ...modifier });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Enter alone is a new line, not a send', async () => {
    const wrapper = mountComposer();
    await input(wrapper).setValue('Hej');

    await input(wrapper).trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends once while a send is on its way', async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as ReturnType<typeof internalFetch>,
    );
    const wrapper = mountComposer();
    await input(wrapper).setValue('Hej');

    await sendButton(wrapper).trigger('click');
    await input(wrapper).trigger('keydown', { key: 'Enter', metaKey: true });
    expect(isDisabled(wrapper)).toBe(true);
    resolve({ message: { id: 'm-9' } });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe('a reply', () => {
    it('shows who it answers and what they wrote', () => {
      const wrapper = mountComposer(PARENT);

      const chip = wrapper.find('[data-testid="quote-thread-replying"]');
      expect(chip.text()).toContain(
        'portal.quotations.thread.replying_to {"name":"Erik Sälj"}',
      );
      expect(chip.text()).toContain('Vi kan leverera i december.');
    });

    it('is cleared with the X', async () => {
      const wrapper = mountComposer(PARENT);

      const cancel = wrapper.find('[data-testid="quote-thread-cancel-reply"]');
      expect(cancel.attributes('aria-label')).toBe(
        'portal.quotations.thread.cancel_reply',
      );
      await cancel.trigger('click');

      expect(wrapper.emitted('update:replyTo')).toEqual([[null]]);
    });

    it('names the message it answers, and is cleared once sent', async () => {
      const wrapper = mountComposer(PARENT);
      await input(wrapper).setValue('Det går bra.');

      await sendButton(wrapper).trigger('click');
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledWith('/api/quotes/q%201/messages', {
        method: 'POST',
        body: { message: 'Det går bra.', answerRef: PARENT.id },
      });
      expect(wrapper.emitted('update:replyTo')).toEqual([[null]]);
    });

    it('shows nothing when there is no reply', () => {
      const wrapper = mountComposer();

      expect(
        wrapper.find('[data-testid="quote-thread-replying"]').exists(),
      ).toBe(false);
    });
  });

  describe('a failed send', () => {
    beforeEach(() => {
      fetchMock.mockRejectedValue(new Error('502'));
    });

    it('keeps the text and the reply, and says it was not sent', async () => {
      const wrapper = mountComposer(PARENT);
      await input(wrapper).setValue('Det går bra.');

      await sendButton(wrapper).trigger('click');
      await flushPromises();

      expect((input(wrapper).element as HTMLTextAreaElement).value).toBe(
        'Det går bra.',
      );
      expect(wrapper.emitted('update:replyTo')).toBeUndefined();
      const alert = wrapper.find('[data-testid="quote-thread-send-error"]');
      expect(alert.attributes('role')).toBe('alert');
      expect(alert.text()).toBe('portal.quotations.thread.send_failed');
      expect(wrapper.emitted('failed')).toHaveLength(1);
      expect(wrapper.emitted('sent')).toBeUndefined();
      expect(isDisabled(wrapper)).toBe(false);
    });

    it('lets the next send that works clear the error', async () => {
      const wrapper = mountComposer();
      await input(wrapper).setValue('Hej');
      await sendButton(wrapper).trigger('click');
      await flushPromises();

      fetchMock.mockResolvedValue({ message: { id: 'm-9' } });
      await sendButton(wrapper).trigger('click');
      await flushPromises();

      expect(
        wrapper.find('[data-testid="quote-thread-send-error"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="quote-thread-hint"]').exists()).toBe(
        true,
      );
    });
  });
});
