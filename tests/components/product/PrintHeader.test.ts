import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PrintHeader from '../../../app/components/product/PrintHeader.vue';

describe('PrintHeader', () => {
  it('renders inside a print-only header element', () => {
    const wrapper = mountComponent(PrintHeader, {
      props: { productUrl: 'https://shop.example.com/se/sv/p/widget' },
    });
    const header = wrapper.find('[data-testid="pdp-print-header"]');
    expect(header.exists()).toBe(true);
    // Hidden on screen; @media print rules in assets/css/print.css unhide
    // this element via its data-testid.
    expect(header.classes().join(' ')).toContain('hidden');
  });

  it('shows the canonical product url', () => {
    const wrapper = mountComponent(PrintHeader, {
      props: { productUrl: 'https://shop.example.com/se/sv/p/widget' },
    });
    expect(wrapper.text()).toContain('https://shop.example.com/se/sv/p/widget');
  });

  it('shows the printed-on label', () => {
    const wrapper = mountComponent(PrintHeader, {
      props: { productUrl: 'https://shop.example.com/se/sv/p/widget' },
    });
    expect(wrapper.text()).toContain('product.printed_on');
  });
});
