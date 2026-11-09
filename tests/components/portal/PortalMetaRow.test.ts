// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { FileText } from 'lucide-vue-next';
import { mountComponent } from '../../utils/component';

import PortalMetaRow from '../../../app/components/portal/PortalMetaRow.vue';

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
};

function mount(props: Record<string, unknown> = {}) {
  return mountComponent(PortalMetaRow, {
    props: {
      rowKey: 'reference',
      testId: 'quote-reference',
      icon: FileText,
      label: 'Offertreferens',
      lines: ['REF: 2611-2-0015-00'],
      ...props,
    },
    global: { stubs },
  });
}

describe('PortalMetaRow', () => {
  it('shows the icon, the label in bold and each line under it', () => {
    const wrapper = mount({ lines: ['9 november 2026', 'Anna Berg'] });

    const row = wrapper.find('[data-testid="quote-reference"]');
    expect(row.attributes('data-meta-row')).toBe('reference');
    expect(row.findComponent(FileText).exists()).toBe(true);
    const texts = row.findAll('p');
    expect(texts[0]!.text()).toBe('Offertreferens');
    expect(texts[0]!.classes()).toContain('font-semibold');
    expect(texts.slice(1).map((p) => p.text())).toEqual([
      '9 november 2026',
      'Anna Berg',
    ]);
  });

  it('has no link without an href', () => {
    const wrapper = mount();

    expect(wrapper.find('a').exists()).toBe(false);
    expect(wrapper.find('[data-testid="quote-reference-link"]').exists()).toBe(
      false,
    );
  });

  it('links the whole first line, and only it, when given an href', () => {
    const wrapper = mount({
      href: '/se/sv/portal/quotations/q-1',
      lines: ['REF: 2611-2-0015-00', 'second'],
    });

    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1);
    const link = wrapper.find('[data-testid="quote-reference-link"]');
    expect(link.text()).toBe('REF: 2611-2-0015-00');
    expect(link.attributes('href')).toBe('/se/sv/portal/quotations/q-1');
    expect(link.classes()).toEqual(['text-primary', 'hover:underline']);
  });
});
