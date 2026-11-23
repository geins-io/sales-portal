import { describe, it, expect, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import LayoutHeaderMenuCollapsible from '../../../app/components/layout/header/LayoutHeaderMenuCollapsible.vue';
import type { MenuItemType } from '#shared/types/cms';

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

const stubs = {
  // Renders the classes it is given, as NavigationMenuLink merges them.
  NavigationMenuLink: {
    props: ['asChild', 'class'],
    template: '<div data-link :class="$props.class"><slot /></div>',
  },
  ChevronDown: { template: '<span />' },
};

function item(
  id: string,
  label: string,
  children: MenuItemType[] = [],
): MenuItemType {
  return {
    id,
    label,
    canonicalUrl: `/se/sv/c/${id}`,
    order: Number(id.replace(/\D/g, '')) || 0,
    children,
  };
}

const tools = item('1', 'Verktyg', [
  item('11', 'Elverktyg', [item('111', 'Borrmaskiner')]),
  item('12', 'Handverktyg'),
]);
const build = item('2', 'Byggmaterial', [item('21', 'Virke')]);
const garden = item('3', 'Trädgård');

function mountMenu(items: MenuItemType[]): VueWrapper {
  return mountComponent(LayoutHeaderMenuCollapsible, {
    props: { items },
    global: { stubs },
  });
}

function toggle(wrapper: VueWrapper, label: string) {
  const button = wrapper
    .findAll('button')
    .find((b) => b.text().includes(label));
  expect(button, `no toggle for ${label}`).toBeDefined();
  return button!;
}

describe('LayoutHeaderMenuCollapsible', () => {
  it('lays the headings out in four columns in reading order', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      item(String(i + 1), `Heading ${i + 1}`),
    );
    const wrapper = mountMenu(items);
    const columns = wrapper.findAll('[data-testid="menu-collapsible"] > ul');
    expect(columns).toHaveLength(4);
    expect(columns.map((c) => c.findAll(':scope > li').length)).toEqual([
      2, 2, 1, 1,
    ]);
    expect(columns[0]!.text()).toContain('Heading 1');
    expect(columns[0]!.text()).toContain('Heading 5');
    expect(columns[1]!.text()).toContain('Heading 2');
    expect(columns[1]!.text()).toContain('Heading 6');
  });

  it('stacks each column on its own, so an open heading moves only its column', () => {
    const wrapper = mountMenu([tools, build]);
    expect(
      wrapper.find('[data-testid="menu-collapsible"]').classes(),
    ).toContain('items-start');
  });

  it('starts with every heading folded', () => {
    const wrapper = mountMenu([tools, build]);
    for (const label of ['Verktyg', 'Byggmaterial']) {
      expect(toggle(wrapper, label).attributes('aria-expanded')).toBe('false');
    }
  });

  it('makes the whole row of a heading with children one toggle button', () => {
    const wrapper = mountMenu([tools]);
    const button = toggle(wrapper, 'Verktyg');
    expect(button.attributes('type')).toBe('button');
    expect(button.classes()).toContain('w-full');
    expect(button.find('svg, span').exists()).toBe(true);
  });

  it('opens a heading on click, grey and bold, with an All in link and its children', async () => {
    const wrapper = mountMenu([tools]);
    const button = toggle(wrapper, 'Verktyg');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(button.classes()).toEqual(
      expect.arrayContaining(['bg-muted', 'font-semibold']),
    );
    const list = wrapper.find(`#${button.attributes('aria-controls')}`);
    expect(list.exists()).toBe(true);
    const links = list.findAll('a');
    expect(links.map((a) => a.text())).toEqual([
      'layout.menu_all_in',
      'Elverktyg',
      'Handverktyg',
    ]);
    expect(links[0]!.attributes('href')).toBe('/se/en/c/1');
  });

  it('closes an open heading on a second click', async () => {
    const wrapper = mountMenu([tools]);
    const button = toggle(wrapper, 'Verktyg');
    await button.trigger('click');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.classes()).not.toContain('font-semibold');
  });

  it('keeps several headings open at once', async () => {
    const wrapper = mountMenu([tools, build]);
    await toggle(wrapper, 'Verktyg').trigger('click');
    await toggle(wrapper, 'Byggmaterial').trigger('click');
    expect(toggle(wrapper, 'Verktyg').attributes('aria-expanded')).toBe('true');
    expect(toggle(wrapper, 'Byggmaterial').attributes('aria-expanded')).toBe(
      'true',
    );
  });

  it('keeps folded links out of the keyboard: inert, and out of the tab order', async () => {
    const wrapper = mountMenu([tools]);
    const button = toggle(wrapper, 'Verktyg');
    const region = () => wrapper.find(`#${button.attributes('aria-controls')}`);
    expect(region().attributes()).toHaveProperty('inert');
    for (const link of region().findAll('a')) {
      expect(link.attributes('tabindex')).toBe('-1');
    }

    await button.trigger('click');
    expect(region().attributes()).not.toHaveProperty('inert');
    for (const link of region().findAll('a')) {
      expect(link.attributes()).not.toHaveProperty('tabindex');
    }
  });

  it('shows no fourth level: a third-level item with children is a plain link', async () => {
    const wrapper = mountMenu([tools]);
    await toggle(wrapper, 'Verktyg').trigger('click');
    expect(wrapper.text()).not.toContain('Borrmaskiner');
    expect(wrapper.findAll('button')).toHaveLength(1);
  });

  it('makes a heading without children a plain link', () => {
    const wrapper = mountMenu([garden]);
    expect(wrapper.find('button').exists()).toBe(false);
    const link = wrapper.find('a');
    expect(link.text()).toBe('Trädgård');
    expect(link.attributes('href')).toBe('/se/en/c/3');
  });

  it('makes a heading without children look like a folded toggle heading', () => {
    const heading = [
      'text-sm',
      'font-medium',
      'px-3',
      'py-2',
      'rounded-md',
      'hover:bg-muted',
    ];
    const wrapper = mountMenu([tools, garden]);
    const link = wrapper
      .findAll('[data-link]')
      .find((l) => l.text() === 'Trädgård');
    expect(link?.classes()).toEqual(expect.arrayContaining(heading));
    expect(toggle(wrapper, 'Verktyg').classes()).toEqual(
      expect.arrayContaining(heading),
    );
    expect(link?.find('a').attributes('class')).toBeUndefined();
  });

  it("puts the folded links' classes on the menu link, not on the anchor", async () => {
    const wrapper = mountMenu([tools]);
    await toggle(wrapper, 'Verktyg').trigger('click');
    const links = wrapper.findAll('[data-link]');
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.find('a').attributes('class')).toBeUndefined();
      expect(link.classes()).toEqual(
        expect.arrayContaining(['text-sm', 'px-3', 'py-1.5', 'rounded-md']),
      );
    }
  });

  it('slides open, with no slide when the visitor prefers reduced motion', () => {
    const wrapper = mountMenu([tools]);
    const button = toggle(wrapper, 'Verktyg');
    const region = wrapper.find(`#${button.attributes('aria-controls')}`);
    expect(region.classes()).toEqual(
      expect.arrayContaining([
        'transition-[grid-template-rows]',
        'motion-reduce:transition-none',
      ]),
    );
  });
});
