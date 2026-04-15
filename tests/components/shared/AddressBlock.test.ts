import { describe, it, expect } from 'vitest';
import { defineComponent, h, Suspense, type VNode } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import AddressBlock from '../../../app/components/shared/AddressBlock.vue';
import type { QuoteAddress } from '../../../shared/types/quote';

const defaultStubs = {
  Icon: defineComponent({
    name: 'Icon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
  NuxtIcon: defineComponent({
    name: 'NuxtIcon',
    props: { name: { type: String, default: '' } },
    setup(props): () => VNode {
      return () => h('span', { class: 'icon', 'data-name': props.name });
    },
  }),
};

async function mountBlock(props: {
  label: string;
  icon?: string;
  address: QuoteAddress;
}) {
  const Wrapper = defineComponent({
    components: { AddressBlock },
    setup() {
      return () =>
        h(Suspense, null, {
          default: () => h(AddressBlock, props as never),
          fallback: () => h('div', { 'data-testid': 'suspense-fallback' }),
        });
    },
  });
  const wrapper = mount(Wrapper, {
    global: { stubs: defaultStubs },
  });
  await flushPromises();
  return wrapper;
}

describe('AddressBlock', () => {
  it('renders the label', async () => {
    const w = await mountBlock({
      label: 'Invoice Address',
      address: { company: 'Acme' },
    });
    expect(w.text()).toContain('Invoice Address');
  });

  it('renders the company on its own line when present', async () => {
    const w = await mountBlock({
      label: 'x',
      address: { company: 'Acme AB', firstName: 'Jane', lastName: 'Doe' },
    });
    expect(w.text()).toContain('Acme AB');
    expect(w.text()).toContain('Jane Doe');
  });

  it('joins first + last name, filtering empty values', async () => {
    const w = await mountBlock({
      label: 'x',
      address: { firstName: 'Jane' },
    });
    expect(w.text()).toContain('Jane');
    expect(w.text()).not.toContain('undefined');
  });

  it('joins zip + city with a single space', async () => {
    const w = await mountBlock({
      label: 'x',
      address: { zip: '12345', city: 'Stockholm' },
    });
    expect(w.text()).toContain('12345 Stockholm');
  });

  it('omits zip+city line when both are missing', async () => {
    const w = await mountBlock({
      label: 'x',
      address: { country: 'SE' },
    });
    expect(w.text()).not.toMatch(/\s{2,}/);
    expect(w.text()).toContain('SE');
  });

  it('renders nothing for missing fields (no "undefined" leaks)', async () => {
    const w = await mountBlock({ label: 'x', address: {} });
    expect(w.text()).not.toContain('undefined');
    expect(w.text()).not.toContain('null');
  });

  it('renders the icon when provided', async () => {
    const w = await mountBlock({
      label: 'x',
      icon: 'lucide:map-pin',
      address: { company: 'Acme' },
    });
    expect(w.find('[data-name="lucide:map-pin"]').exists()).toBe(true);
  });

  it('renders no icon element when icon prop is omitted', async () => {
    const w = await mountBlock({
      label: 'x',
      address: { company: 'Acme' },
    });
    expect(w.find('.icon').exists()).toBe(false);
  });
});
