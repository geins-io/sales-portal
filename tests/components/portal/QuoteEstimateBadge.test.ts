import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import QuoteEstimateBadge from '../../../app/components/portal/QuoteEstimateBadge.vue';

// The popover renders into document.body, outside the wrapper.
const note = () =>
  document.body.querySelector('[data-testid="quote-estimate-note"]');

/** "≈ Estimated" on a request's summary, with what it means behind a click. */
describe('QuoteEstimateBadge', () => {
  it('says the amounts are an estimate, with the note closed', () => {
    const wrapper = mountComponent(QuoteEstimateBadge);

    const badge = wrapper.find('[data-testid="quote-estimate-badge"]');
    expect(badge.text()).toContain('portal.quotations.request.estimate_badge');
    expect(badge.attributes('aria-expanded')).toBe('false');
    expect(note()).toBeNull();
    wrapper.unmount();
  });

  it('opens the note on click', async () => {
    const wrapper = mountComponent(QuoteEstimateBadge, {
      attachTo: document.body,
    });

    await wrapper.find('[data-testid="quote-estimate-badge"]').trigger('click');

    expect(note()?.textContent).toContain(
      'portal.quotations.request.estimate_note',
    );
    wrapper.unmount();
  });
});
