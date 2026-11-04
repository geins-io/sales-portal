import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import QuoteConfirmation from '../../../app/components/checkout/QuoteConfirmation.vue';

// Appends the values, so the number inside a sentence can be checked.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

const QUOTATION_PATH = '/se/en/portal/quotations/q-001';

function mountCard(props: {
  kind: 'request' | 'order';
  number: string;
  quoteNumber?: string;
}) {
  return mountComponent(QuoteConfirmation, {
    props: { quotationPath: QUOTATION_PATH, ...props },
  });
}

const find = (wrapper: ReturnType<typeof mountCard>, id: string) =>
  wrapper.find(`[data-testid="${id}"]`);

/** The top card of both thank-you pages in the quotation flow. */
describe('QuoteConfirmation', () => {
  describe('after a quote request', () => {
    const mountRequest = () =>
      mountCard({ kind: 'request', number: '2610-2-0007-00' });

    it('says the request was sent, with its number', () => {
      const wrapper = mountRequest();

      expect(find(wrapper, 'quote-thanks').attributes('data-kind')).toBe(
        'request',
      );
      expect(wrapper.find('h1').text()).toBe(
        'portal.quotations.confirm.request_title',
      );
      expect(wrapper.text()).toContain(
        'portal.quotations.confirm.request_body',
      );
      expect(find(wrapper, 'quote-thanks-number').text()).toBe(
        'portal.quotations.confirm.request_number: 2610-2-0007-00',
      );
    });

    it('lists what happens next, in order', () => {
      const steps = find(mountRequest(), 'quote-thanks-next').findAll('li');

      expect(steps.map((step) => step.text())).toEqual([
        'portal.quotations.confirm.next_1',
        'portal.quotations.confirm.next_2',
        'portal.quotations.confirm.next_3',
      ]);
    });

    it('names no quotation an order came from', () => {
      expect(find(mountRequest(), 'quote-thanks-from').exists()).toBe(false);
    });

    it('leads to the request in the portal', () => {
      const cta = find(mountRequest(), 'quote-thanks-portal');

      expect(cta.attributes('href')).toBe(QUOTATION_PATH);
      expect(cta.text()).toBe('portal.quotations.confirm.view_request');
    });
  });

  describe('after an order from a quotation', () => {
    const mountOrder = () =>
      mountCard({
        kind: 'order',
        number: '1155',
        quoteNumber: '2610-2-0011-00',
      });

    it('says the order is confirmed, with the order number', () => {
      const wrapper = mountOrder();

      expect(find(wrapper, 'quote-thanks').attributes('data-kind')).toBe(
        'order',
      );
      expect(wrapper.find('h1').text()).toBe(
        'portal.quotations.confirm.order_title',
      );
      expect(wrapper.text()).toContain('portal.quotations.confirm.order_body');
      expect(find(wrapper, 'quote-thanks-number').text()).toBe(
        'portal.quotations.confirm.order_number: 1155',
      );
    });

    it('names the quotation the order came from', () => {
      expect(find(mountOrder(), 'quote-thanks-from').text()).toBe(
        'portal.quotations.confirm.from_quotation 2610-2-0011-00',
      );
    });

    it('lists no next steps', () => {
      expect(find(mountOrder(), 'quote-thanks-next').exists()).toBe(false);
    });

    it('leads to the quotation in the portal', () => {
      const cta = find(mountOrder(), 'quote-thanks-portal');

      expect(cta.attributes('href')).toBe(QUOTATION_PATH);
      expect(cta.text()).toBe('portal.quotations.confirm.view_quotation');
    });
  });

  it('offers to go on shopping', () => {
    const link = find(
      mountCard({ kind: 'request', number: 'Q-1' }),
      'quote-thanks-continue',
    );

    expect(link.attributes('href')).toBe('/se/en/products');
    expect(link.text()).toBe('portal.quotations.confirm.continue_shopping');
  });

  it("paints the portal button with the store's button colours", () => {
    const classes = find(
      mountCard({ kind: 'order', number: '1155' }),
      'quote-thanks-portal',
    ).classes();

    expect(classes).toContain('bg-button-background');
    expect(classes).toContain('text-button-text');
  });

  it('renders what it is given below the card', () => {
    const wrapper = mountComponent(QuoteConfirmation, {
      props: { kind: 'order', number: '1155', quotationPath: QUOTATION_PATH },
      slots: { default: '<div data-testid="contents" />' },
    });

    expect(wrapper.find('[data-testid="contents"]').exists()).toBe(true);
  });
});
