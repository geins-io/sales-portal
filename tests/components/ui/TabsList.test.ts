import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Tabs, TabsList, TabsTrigger } from '../../../app/components/ui/tabs';

/** happy-dom lays nothing out: the row's widths are what the test says. */
let row = { scrollWidth: 300, clientWidth: 300 };

function isRow(el: Element) {
  return el.getAttribute('role') === 'tablist';
}

vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(
  function (this: HTMLElement) {
    return isRow(this) ? row.scrollWidth : 0;
  },
);
vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
  function (this: HTMLElement) {
    return isRow(this) ? row.clientWidth : 0;
  },
);

afterEach(() => {
  row = { scrollWidth: 300, clientWidth: 300 };
});

function mountRow(listProps: Record<string, unknown> = {}) {
  return mount(
    defineComponent({
      render: () =>
        h(Tabs, { defaultValue: 'a' }, () =>
          h(TabsList, { variant: 'underline', ...listProps }, () =>
            ['a', 'b', 'c'].map((value) =>
              h(TabsTrigger, { value }, () => value),
            ),
          ),
        ),
    }),
    { attachTo: document.body },
  );
}

const fade = '[data-slot="tabs-list-fade"]';

describe('TabsList, underline', () => {
  it("scrolls inside the row, with the caller's test id and class on the tab list", () => {
    const wrapper = mountRow({ 'data-testid': 'row', class: 'mb-2' });
    const list = wrapper.get('[role="tablist"]');
    expect(list.attributes('data-testid')).toBe('row');
    expect(list.classes()).toEqual(
      expect.arrayContaining([
        'overflow-x-auto',
        'scrollbar-none',
        'border-b',
        'mb-2',
      ]),
    );
    wrapper.unmount();
  });

  it('shows no fade when the row fits', async () => {
    const wrapper = mountRow();
    await nextTick();
    expect(wrapper.find(fade).exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows the fade while there is more row to the right, and drops it at the end', async () => {
    row = { scrollWidth: 380, clientWidth: 328 };
    const wrapper = mountRow();
    await nextTick();
    expect(wrapper.find(fade).exists()).toBe(true);

    const list = wrapper.get('[role="tablist"]').element as HTMLElement;
    list.scrollLeft = 52;
    list.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(wrapper.find(fade).exists()).toBe(false);
    wrapper.unmount();
  });

  it('fades to the page background by default and to the card on a card', async () => {
    row = { scrollWidth: 380, clientWidth: 328 };
    const page = mountRow();
    await nextTick();
    expect(page.get(fade).classes()).toContain('from-site-background');
    page.unmount();

    const card = mountRow({ surface: 'card' });
    await nextTick();
    expect(card.get(fade).classes()).toContain('from-card');
    card.unmount();
  });
});

describe('TabsList, pill', () => {
  it('is the tab list itself, with no scroll fade', async () => {
    row = { scrollWidth: 380, clientWidth: 328 };
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(Tabs, { defaultValue: 'a' }, () =>
            h(TabsList, { 'data-testid': 'pill' }, () =>
              h(TabsTrigger, { value: 'a' }, () => 'a'),
            ),
          ),
      }),
    );
    await nextTick();
    const list = wrapper.get('[data-testid="pill"]');
    expect(list.attributes('role')).toBe('tablist');
    expect(list.classes()).not.toContain('overflow-x-auto');
    expect(wrapper.find(fade).exists()).toBe(false);
  });
});
