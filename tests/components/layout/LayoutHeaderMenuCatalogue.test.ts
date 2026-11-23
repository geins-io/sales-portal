import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { VueWrapper } from '@vue/test-utils';
import { mountComponent } from '../../utils/component';
import LayoutHeaderMenuCatalogue from '../../../app/components/layout/header/LayoutHeaderMenuCatalogue.vue';
import type { MenuItemType } from '#shared/types/cms';

vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

const stubs = {
  // Renders the classes it is given, as NavigationMenuLink merges them.
  NavigationMenuLink: {
    props: ['asChild', 'class'],
    template: '<div data-link :class="$props.class"><slot /></div>',
  },
  ChevronRight: { template: '<span />' },
  CircleArrowRight: { template: '<span />' },
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
    order: Number(id) || 0,
    children,
  };
}

const tools = item('1', 'Verktyg', [
  item('11', 'Elverktyg', [item('111', 'Borrmaskiner')]),
  item('12', 'Handverktyg'),
]);
const build = item('2', 'Byggmaterial', [item('21', 'Virke')]);
const garden = item('3', 'Trädgård');

function mountMenu(items: MenuItemType[] = [tools, build, garden]) {
  return mountComponent(LayoutHeaderMenuCatalogue, {
    props: { items },
    global: { stubs },
  });
}

const columns = (wrapper: VueWrapper) =>
  wrapper.findAll('[data-testid="menu-catalogue"] > [data-menu-column]');

function category(wrapper: VueWrapper, label: string) {
  const button = wrapper
    .findAll('button')
    .find((b) => b.text().includes(label));
  expect(button, `no button for ${label}`).toBeDefined();
  return button!;
}

describe('LayoutHeaderMenuCatalogue', () => {
  it('opens with only the list of categories, none chosen', () => {
    const wrapper = mountMenu();
    expect(columns(wrapper)).toHaveLength(1);
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('aria-expanded')).toBe('false');
      expect(button.classes()).not.toContain('bg-muted');
    }
  });

  it('makes a category with children a button and one without a plain link', () => {
    const wrapper = mountMenu();
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([
      'Verktyg',
      'Byggmaterial',
    ]);
    const link = wrapper.findAll('a').find((a) => a.text() === 'Trädgård');
    expect(link?.attributes('href')).toBe('/se/en/c/3');
  });

  it('makes a link row look like a button row: same size, weight, padding, radius and hover', () => {
    const row = [
      'text-base',
      'font-medium',
      'px-3',
      'py-2.5',
      'rounded-md',
      'hover:bg-muted',
    ];
    const wrapper = mountMenu();
    const link = wrapper
      .findAll('[data-link]')
      .find((l) => l.text() === 'Trädgård');
    expect(link?.classes()).toEqual(expect.arrayContaining(row));
    expect(category(wrapper, 'Verktyg').classes()).toEqual(
      expect.arrayContaining(row),
    );
    // Nothing on the anchor itself, where it would sit beside the menu
    // link's own small text and padding instead of replacing them.
    expect(link?.find('a').attributes('class')).toBeUndefined();
  });

  it("puts the column links' classes on the menu link, not on the anchor", async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    const links = columns(wrapper)[1]!.findAll('[data-link]');
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.find('a').attributes('class')).toBeUndefined();
      expect(link.classes()).toEqual(
        expect.arrayContaining(['px-3', 'rounded-md']),
      );
    }
    expect(links[1]!.classes()).toEqual(
      expect.arrayContaining(['text-sm', 'py-1.5', 'hover:bg-muted']),
    );
  });

  it('opens the children in a column beside the list, headed by a link to the category', async () => {
    const wrapper = mountMenu();
    const button = category(wrapper, 'Verktyg');
    await button.trigger('click');

    expect(button.attributes('aria-expanded')).toBe('true');
    expect(button.classes()).toContain('bg-muted');
    const cols = columns(wrapper);
    expect(cols).toHaveLength(2);
    expect(cols[1]!.attributes('id')).toBe(button.attributes('aria-controls'));

    const links = cols[1]!.findAll('a');
    expect(links[0]!.text()).toBe('Verktyg');
    expect(links[0]!.attributes('href')).toBe('/se/en/c/1');
    expect(links[0]!.attributes('aria-label')).toBe('layout.menu_go_to');
    expect(links.slice(1).map((a) => a.text())).toEqual([
      'Elverktyg',
      'Handverktyg',
    ]);
  });

  it('closes the open category on a second click', async () => {
    const wrapper = mountMenu();
    const button = category(wrapper, 'Verktyg');
    await button.trigger('click');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes()).not.toHaveProperty('aria-controls');
    expect(columns(wrapper)).toHaveLength(1);
  });

  it('switches the column to another category, keeping one open', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    await category(wrapper, 'Byggmaterial').trigger('click');
    expect(category(wrapper, 'Verktyg').attributes('aria-expanded')).toBe(
      'false',
    );
    expect(category(wrapper, 'Byggmaterial').attributes('aria-expanded')).toBe(
      'true',
    );
    const cols = columns(wrapper);
    expect(cols).toHaveLength(2);
    expect(cols[1]!.text()).toContain('Virke');
    expect(cols[1]!.text()).not.toContain('Elverktyg');
  });

  it('shows no fourth level: a third-level item with children is a plain link', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    const cols = columns(wrapper);
    expect(cols[1]!.find('button').exists()).toBe(false);
    const link = cols[1]!.findAll('a').find((a) => a.text() === 'Elverktyg');
    expect(link?.attributes('href')).toBe('/se/en/c/11');
    expect(wrapper.text()).not.toContain('Borrmaskiner');
  });

  it('gives each catalogue in the app its own column id', async () => {
    const Two = defineComponent({
      components: { LayoutHeaderMenuCatalogue },
      props: { items: { type: Array, required: true } },
      template:
        '<div><LayoutHeaderMenuCatalogue :items="items" /><LayoutHeaderMenuCatalogue :items="items" /></div>',
    });
    const wrapper = mountComponent(Two, {
      props: { items: [tools] },
      global: { stubs },
    });
    const [first, second] = wrapper.findAll('button');
    await first!.trigger('click');
    await second!.trigger('click');
    expect(first!.attributes('aria-controls')).toBeTruthy();
    expect(first!.attributes('aria-controls')).not.toBe(
      second!.attributes('aria-controls'),
    );
  });
});
