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
  item('11', 'Elverktyg', [
    item('111', 'Borrmaskiner'),
    item('112', 'Slipmaskiner'),
  ]),
  item('12', 'Handverktyg'),
  item('13', 'Mätverktyg', [item('131', 'Vattenpass')]),
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
    // The heading link and Handverktyg; Elverktyg and Mätverktyg are toggles.
    const links = columns(wrapper)[1]!.findAll('[data-link]');
    expect(links.length).toBe(2);
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
    expect(
      cols[1]!
        .findAll('a, button')
        .slice(1)
        .map((row) => row.text()),
    ).toEqual(['Elverktyg', 'Handverktyg', 'Mätverktyg']);
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

  it('makes a third-level item with children a toggle in the column and one without a link', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    const cols = columns(wrapper);
    const toggle = cols[1]!.find('button');
    expect(toggle.text()).toBe('Elverktyg');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.attributes()).not.toHaveProperty('aria-controls');
    expect(toggle.classes()).not.toContain('bg-muted');
    const link = cols[1]!.findAll('a').find((a) => a.text() === 'Handverktyg');
    expect(link?.attributes('href')).toBe('/se/en/c/12');
    expect(wrapper.text()).not.toContain('Borrmaskiner');
  });

  it("sizes a column's toggle like the column's links, with the chevron", async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    const col = columns(wrapper)[1]!;
    const toggle = col.find('button');
    const link = col
      .findAll('[data-link]')
      .find((l) => l.text() === 'Handverktyg');
    for (const cls of [
      'text-sm',
      'py-1.5',
      'px-3',
      'rounded-md',
      'hover:bg-muted',
    ]) {
      expect(toggle.classes()).toContain(cls);
      expect(link?.classes()).toContain(cls);
    }
    expect(toggle.classes()).not.toContain('text-base');
    expect(toggle.find('span + span').exists()).toBe(true);
  });

  it('opens the fourth level in a column beside the third, headed by a link to the item', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    const toggle = category(wrapper, 'Elverktyg');
    await toggle.trigger('click');

    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(toggle.classes()).toContain('bg-muted');
    const cols = columns(wrapper);
    expect(cols).toHaveLength(3);
    expect(cols[2]!.attributes('id')).toBe(toggle.attributes('aria-controls'));
    expect(cols[2]!.attributes('id')).not.toBe(
      category(wrapper, 'Verktyg').attributes('aria-controls'),
    );

    const links = cols[2]!.findAll('a');
    expect(links.map((a) => a.text())).toEqual([
      'Elverktyg',
      'Borrmaskiner',
      'Slipmaskiner',
    ]);
    expect(links[0]!.attributes('aria-label')).toBe('layout.menu_go_to');
    expect(links[0]!.attributes('href')).toBe('/se/en/c/11');
    expect(links[1]!.attributes('href')).toBe('/se/en/c/111');
    expect(cols[2]!.find('button').exists()).toBe(false);
  });

  it("gives the fourth column the third column's look", async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    await category(wrapper, 'Elverktyg').trigger('click');
    const cols = columns(wrapper);
    expect(cols[2]!.classes()).toEqual(cols[1]!.classes());
    const third = cols[1]!.findAll('[data-link]');
    const fourth = cols[2]!.findAll('[data-link]');
    expect(fourth[0]!.classes()).toEqual(third[0]!.classes());
    expect(fourth[1]!.classes()).toEqual(third[1]!.classes());
  });

  it('closes the fourth column on a second click, and keeps the third', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    const toggle = category(wrapper, 'Elverktyg');
    await toggle.trigger('click');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.attributes()).not.toHaveProperty('aria-controls');
    expect(columns(wrapper)).toHaveLength(2);
  });

  it('switches the fourth column to another third-level item', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    await category(wrapper, 'Elverktyg').trigger('click');
    await category(wrapper, 'Mätverktyg').trigger('click');
    expect(category(wrapper, 'Elverktyg').attributes('aria-expanded')).toBe(
      'false',
    );
    expect(category(wrapper, 'Mätverktyg').attributes('aria-expanded')).toBe(
      'true',
    );
    const cols = columns(wrapper);
    expect(cols).toHaveLength(3);
    expect(cols[2]!.text()).toContain('Vattenpass');
    expect(cols[2]!.text()).not.toContain('Borrmaskiner');
  });

  it('closes the fourth column with its second-level category, and does not reopen it', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    await category(wrapper, 'Elverktyg').trigger('click');
    await category(wrapper, 'Byggmaterial').trigger('click');
    expect(columns(wrapper)).toHaveLength(2);
    expect(wrapper.text()).not.toContain('Borrmaskiner');

    await category(wrapper, 'Verktyg').trigger('click');
    expect(columns(wrapper)).toHaveLength(2);
    expect(category(wrapper, 'Elverktyg').attributes('aria-expanded')).toBe(
      'false',
    );

    await category(wrapper, 'Elverktyg').trigger('click');
    await category(wrapper, 'Verktyg').trigger('click');
    expect(columns(wrapper)).toHaveLength(1);
  });

  it('makes a fourth-level item a link whether it has no children or an empty list', async () => {
    const leaf: MenuItemType = {
      id: '113',
      label: 'Utan barn',
      canonicalUrl: '/se/sv/c/113',
      order: 113,
    };
    const menu = item('1', 'Verktyg', [
      item('11', 'Elverktyg', [leaf, item('112', 'Tom lista', [])]),
    ]);
    const wrapper = mountMenu([menu]);
    await category(wrapper, 'Verktyg').trigger('click');
    await category(wrapper, 'Elverktyg').trigger('click');
    const col = columns(wrapper)[2]!;
    expect(col.find('button').exists()).toBe(false);
    expect(col.findAll('a').map((a) => a.text())).toEqual([
      'Elverktyg',
      'Tom lista',
      'Utan barn',
    ]);
  });

  it('closes the fourth column when its item leaves the menu', async () => {
    const wrapper = mountMenu();
    await category(wrapper, 'Verktyg').trigger('click');
    await category(wrapper, 'Elverktyg').trigger('click');
    const fresh = item('1', 'Verktyg', [item('12', 'Handverktyg')]);
    await wrapper.setProps({ items: [fresh] });
    expect(columns(wrapper)).toHaveLength(1);
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
