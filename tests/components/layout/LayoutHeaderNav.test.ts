import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { nextTick, ref } from 'vue';
import { shallowMountComponent } from '../../utils/component';
import LayoutHeaderNav from '../../../app/components/layout/header/LayoutHeaderNav.vue';
import { useTenant } from '../../../app/composables/useTenant';

import type { MenuType } from '@geins/types';

const mockMenu = ref<MenuType | null>(null);

/**
 * The menu location the tenant config names for `cms.menus.header_main`.
 *
 * The fetch stub used to answer with `mockMenu` for every call, so the nav
 * rendered the stubbed response whatever the config said — swapping the
 * component to another menu key would not have failed a single test here.
 * Keying the stub on the `menuLocationId` the config produced is what binds
 * these assertions to the config: `useCmsMenuData` resolves the key through
 * `useCmsMenu`, and the id it puts in the query is the configured one.
 *
 * That binding is file-wide on purpose. Every test here now goes through the
 * configured path, so pointing the component at another menu key turns eight
 * of them red rather than one. That is the dependency, not a brittle spec:
 * before this, not a single test in the file would have noticed the swap.
 */
// Change this and seven tests go red, six of them rendering tests whose titles
// say nothing about configuration. That is the binding working, not a broken
// component: `renders the header_main menu from the configured menuLocationId`
// falls alongside them and is the one that explains why.
const HEADER_MENU_LOCATION = 'header-main-location';

type MenuQuery = { menuLocationId?: string };

function menuFetchReturn(_url: unknown, options?: { query?: unknown }) {
  const raw = options?.query;
  // `query` is a computed in useCmsMenuData; unwrap before reading the id.
  const resolved =
    raw != null && typeof raw === 'object' && 'value' in raw
      ? (raw as { value: MenuQuery }).value
      : (raw as MenuQuery | undefined);
  return {
    data:
      resolved?.menuLocationId === HEADER_MENU_LOCATION ? mockMenu : ref(null),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    execute: vi.fn(),
    status: ref('success'),
  };
}

vi.mock('#app/composables/fetch', () => ({
  useFetch: (...args: Parameters<typeof menuFetchReturn>) =>
    menuFetchReturn(...args),
  $fetch: vi.fn(),
}));

vi.stubGlobal('useFetch', menuFetchReturn);

function configureHeaderMenu(menuLocationId: string | null) {
  const { tenant } = useTenant();
  const current = tenant.value;
  assert.isDefined(current);
  tenant.value = {
    ...current,
    cms: {
      ...current.cms,
      menus: menuLocationId === null ? {} : { header_main: { menuLocationId } },
    },
  };
}

// Mock useRequestURL
vi.stubGlobal('useRequestURL', () => new URL('https://test.example.com'));

// Stubs for shadcn-vue navigation-menu wrappers + Nuxt auto-resolved names
const navStubs = {
  // shadcn-vue component names (from explicit import)
  NavigationMenu: {
    template: '<div data-slot="navigation-menu"><slot /></div>',
  },
  NavigationMenuList: {
    template: '<div data-slot="navigation-menu-list"><slot /></div>',
  },
  NavigationMenuItem: { template: '<div><slot /></div>' },
  NavigationMenuTrigger: { template: '<button><slot /></button>' },
  NavigationMenuContent: {
    template: '<div data-slot="navigation-menu-content"><slot /></div>',
  },
  NavigationMenuLink: { template: '<div><slot /></div>' },
  // Nuxt auto-resolved names (ui prefix)
  UiNavigationMenu: { template: '<div><slot /></div>' },
  UiNavigationMenuList: { template: '<div><slot /></div>' },
  UiNavigationMenuItem: { template: '<div><slot /></div>' },
  UiNavigationMenuTrigger: { template: '<button><slot /></button>' },
  UiNavigationMenuContent: { template: '<div><slot /></div>' },
  UiNavigationMenuLink: { template: '<div><slot /></div>' },
  ChevronDown: { template: '<span />' },
  NuxtLink: { template: '<a><slot /></a>' },
};

describe('LayoutHeaderNav', () => {
  const mountOptions = { global: { stubs: navStubs } };

  beforeEach(() => {
    configureHeaderMenu(HEADER_MENU_LOCATION);
  });

  it('renders the header_main menu from the configured menuLocationId', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
      ],
    };

    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);

    expect(wrapper.find('nav').exists()).toBe(true);
    expect(wrapper.text()).toContain('Epoxi');
  });

  it('renders no nav when header_main names a different menuLocationId', () => {
    // Same menu available, different id in the config. Without this half the
    // case above would pass on any config at all — which is exactly what the
    // blanket fetch stub used to do.
    configureHeaderMenu('some-other-location');
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
      ],
    };

    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);

    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders no nav when the tenant configures no header_main menu', () => {
    configureHeaderMenu(null);
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
      ],
    };

    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);

    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders nothing when menu is null', () => {
    mockMenu.value = null;
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders nothing when menuItems is empty', () => {
    mockMenu.value = { id: '1', title: 'Main', menuItems: [] };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.find('nav').exists()).toBe(false);
  });

  it('renders top-level menu items', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Epoxi', canonicalUrl: '/se/sv/l/epoxi', order: 1 },
        {
          id: '2',
          label: 'Fixturer',
          canonicalUrl: '/se/sv/l/fixturer',
          order: 2,
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Epoxi');
    expect(wrapper.text()).toContain('Fixturer');
  });

  it('filters out hidden items', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        { id: '1', label: 'Visible', order: 1 },
        { id: '2', label: 'Hidden', hidden: true, order: 2 },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Visible');
    expect(wrapper.text()).not.toContain('Hidden');
  });

  it('renders children in dropdown for items with children', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        {
          id: '1',
          label: 'Category',
          order: 1,
          children: [
            { id: '1-1', label: 'Sub A', canonicalUrl: '/sub-a', order: 1 },
            { id: '1-2', label: 'Sub B', canonicalUrl: '/sub-b', order: 2 },
          ],
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    expect(wrapper.text()).toContain('Sub A');
    expect(wrapper.text()).toContain('Sub B');
  });

  it('caps the mega menu height and scrolls its contents internally', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [
        {
          id: '1',
          label: 'Category',
          order: 1,
          children: [
            { id: '1-1', label: 'Sub A', canonicalUrl: '/sub-a', order: 1 },
          ],
        },
      ],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    const panel = wrapper.find('.overflow-y-auto');
    // Tall categories must scroll inside the panel, never the page behind it.
    expect(panel.exists()).toBe(true);
    // A max-height cap is what bounds the panel; value stays a tuning knob, so
    // assert the cap exists rather than pinning the exact pixel target.
    expect(panel.classes().some((c) => c.startsWith('max-h-['))).toBe(true);
  });

  describe('many top-level items', () => {
    const manyItems = (): MenuType => ({
      id: '1',
      title: 'Main',
      menuItems: [
        {
          id: '1',
          label: 'Category',
          order: 1,
          children: [
            { id: '1-1', label: 'Sub A', canonicalUrl: '/sub-a', order: 1 },
          ],
        },
        ...Array.from({ length: 11 }, (_, i) => ({
          id: `${i + 2}`,
          label: `Relining Connection ${i + 2}`,
          canonicalUrl: `/l/item-${i + 2}`,
          order: i + 2,
        })),
      ],
    });

    type Wrapper = ReturnType<typeof shallowMountComponent>;

    const BACK = 'button[data-nav-arrow="back"]';
    const FORWARD = 'button[data-nav-arrow="forward"]';

    function scrollContainer(wrapper: Wrapper) {
      const scroller = wrapper.find('[data-slot="navigation-menu-list"]');
      assert.isTrue(scroller.exists(), 'no list rendered');
      return scroller;
    }

    function root(wrapper: Wrapper) {
      return wrapper.find('[data-slot="navigation-menu"]');
    }

    /**
     * happy-dom does no layout, so the widths the component measures are set
     * by hand: `bar` is the room the list has without arrows, `list` its own
     * visible width, `content` the width of all items at their narrowest.
     */
    function setGeometry(
      wrapper: Wrapper,
      g: { bar: number; list: number; content: number; scrollLeft?: number },
    ) {
      const list = scrollContainer(wrapper).element as HTMLElement;
      const bar = root(wrapper).element.parentElement;
      assert.isNotNull(bar);
      let left = g.scrollLeft ?? 0;
      Object.defineProperty(bar, 'clientWidth', {
        configurable: true,
        value: g.bar,
      });
      Object.defineProperty(list, 'clientWidth', {
        configurable: true,
        value: g.list,
      });
      Object.defineProperty(list, 'scrollWidth', {
        configurable: true,
        value: g.content,
      });
      Object.defineProperty(list, 'scrollLeft', {
        configurable: true,
        get: () => left,
        set: (v: number) => {
          left = v;
        },
      });
      return list;
    }

    // The last item is a plain link; the first one's links sit in its mega menu.
    function topLink(wrapper: Wrapper) {
      const link = wrapper.findAll('a').at(-1);
      assert.isDefined(link);
      return link.element as HTMLElement;
    }

    async function settle() {
      await nextTick();
      await nextTick();
    }

    async function mountOverflowing(scrollLeft = 0) {
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const list = setGeometry(wrapper, {
        bar: 1000,
        list: 920,
        content: 1600,
        scrollLeft,
      });
      window.dispatchEvent(new Event('resize'));
      await settle();
      return { wrapper, list };
    }

    function wheel(target: Element, init: WheelEventInit) {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
      });
      // happy-dom's WheelEvent drops the MouseEvent fields of its init.
      Object.defineProperty(event, 'shiftKey', { value: !!init.shiftKey });
      target.dispatchEvent(event);
      return event;
    }

    it('puts every top-level item in one hidden-scrollbar scroll container', () => {
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const scroller = scrollContainer(wrapper);

      expect(scroller.classes()).toContain('overflow-x-auto');
      expect(scroller.classes()).toContain('scrollbar-none');
      expect(scroller.text()).toContain('Category');
      for (let i = 2; i <= 12; i++) {
        expect(scroller.text()).toContain(`Relining Connection ${i}`);
      }
    });

    it('lets a label wrap inside its item', () => {
      // The items never flow onto a second row (a flex row does not wrap); the
      // text inside one may, so a menu only scrolls once wrapping is not enough.
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const classes = scrollContainer(wrapper).classes();
      expect(classes).not.toContain('whitespace-nowrap');
      expect(classes).not.toContain('flex-wrap');
    });

    it('caps a link label at two lines, each unbreakable', () => {
      // Squeezed to its longest word, a three-word label went to three lines
      // and the third was clipped. Two unbreakable halves make two lines the
      // narrowest an item gets; past that the bar overflows instead.
      mockMenu.value = {
        id: '1',
        title: 'Main',
        menuItems: [
          {
            id: '1',
            label: 'Rör och kopplingar',
            canonicalUrl: '/l/ror',
            order: 1,
          },
        ],
      };
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const link = wrapper.find('a');
      // One wrapper span: the link is inline-flex, so loose spans would each
      // become a flex item and sit side by side.
      const label = link.findAll('a > span');
      expect(label).toHaveLength(1);
      const lines = label[0]!.findAll('span.whitespace-nowrap');
      expect(lines.map((l) => l.text())).toEqual(['Rör och', 'kopplingar']);
      expect(link.text()).toBe('Rör och kopplingar');
    });

    it('never scrolls vertically', () => {
      // overflow-x: auto alone makes overflow-y auto as well.
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      expect(scrollContainer(wrapper).classes()).toContain('overflow-y-hidden');
    });

    it('leaves room for the focus rings at both ends without moving the items', () => {
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const classes = scrollContainer(wrapper).classes();
      expect(classes).toContain('px-[3px]');
      expect(classes).toContain('-mx-[3px]');
    });

    it('lets the scroll container shrink below its content width', () => {
      // reka-ui wraps the list in an unclassed div that is a flex item of the
      // root; at its default min-width it grows to the content and never scrolls.
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const classes = root(wrapper).classes();
      expect(classes).toContain('min-w-0');
      expect(classes).toContain('[&>div]:min-w-0');
      expect(classes).toContain('[&>div]:flex-1');
    });

    it('anchors the dropdown to the nav, outside the scroll container', () => {
      // An overflow element clips an absolute descendant only when that
      // descendant's containing block is inside it. So the nearest positioned
      // ancestor of the dropdown must be the <nav>, which holds the scroller.
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
      const nav = wrapper.find('nav').element;
      const scroller = scrollContainer(wrapper).element;
      const dropdown = wrapper.find(
        '[data-slot="navigation-menu-content"]',
      ).element;

      // reka-ui's list wrapper div sets an inline position: relative; the root
      // overrides it, and the stubs do not render that div.
      expect(root(wrapper).classes()).toContain('[&>div]:!static');

      const isPositioned = (el: Element) => {
        const c = el.classList;
        if (c.contains('!static')) return false;
        return ['relative', 'absolute', 'fixed', 'sticky'].some(
          (p) => c.contains(p) || c.contains(`!${p}`),
        );
      };
      let anchor = dropdown.parentElement;
      while (anchor && !isPositioned(anchor)) anchor = anchor.parentElement;

      expect(anchor).toBe(nav);
      expect(scroller.contains(dropdown)).toBe(true);
      expect(nav.contains(scroller)).toBe(true);
    });

    describe('arrows', () => {
      it('shows no arrows when the items fit', async () => {
        mockMenu.value = manyItems();
        const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
        setGeometry(wrapper, { bar: 1000, list: 1000, content: 1000 });
        window.dispatchEvent(new Event('resize'));
        await settle();

        expect(wrapper.find(BACK).exists()).toBe(false);
        expect(wrapper.find(FORWARD).exists()).toBe(false);
      });

      it('keeps a 24px gutter on each side of the list whether or not the items fit', async () => {
        // The gutters replace the container's side padding, so the items sit
        // where they did before the arrows existed and never move when the
        // arrows appear.
        for (const content of [1000, 1600]) {
          mockMenu.value = manyItems();
          const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
          setGeometry(wrapper, { bar: 1000, list: 1000, content });
          window.dispatchEvent(new Event('resize'));
          await settle();

          const bar = root(wrapper).element.parentElement;
          assert.isNotNull(bar);
          const row = bar.parentElement;
          assert.isNotNull(row);
          expect(row.classList.contains('px-4')).toBe(false);
          expect(row.classList.contains('lg:px-6')).toBe(false);
          const [start, , end] = Array.from(row.children);
          expect(start?.getAttribute('data-nav-gutter')).toBe('start');
          expect(end?.getAttribute('data-nav-gutter')).toBe('end');
          for (const gutter of [start, end]) {
            expect(gutter?.classList.contains('w-6')).toBe(true);
            expect(gutter?.classList.contains('shrink-0')).toBe(true);
            // Two-line labels are taller than the arrow; the gutter must cover
            // the whole row so no descender shows beside it while scrolled.
            expect(gutter?.classList.contains('self-stretch')).toBe(true);
            expect(gutter?.classList.contains('items-center')).toBe(true);
          }
        }
      });

      it('puts each arrow inside its gutter, no wider than the gutter', async () => {
        const { wrapper } = await mountOverflowing();
        const back = wrapper.find(BACK);
        const forward = wrapper.find(FORWARD);
        expect(
          back.element
            .closest('[data-nav-gutter]')
            ?.getAttribute('data-nav-gutter'),
        ).toBe('start');
        expect(
          forward.element
            .closest('[data-nav-gutter]')
            ?.getAttribute('data-nav-gutter'),
        ).toBe('end');
        for (const arrow of [back, forward]) {
          expect(arrow.classes()).toContain('w-6');
          expect(arrow.classes()).not.toContain('size-9');
        }
      });

      it('leaves the gutters empty when the items fit', async () => {
        mockMenu.value = manyItems();
        const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
        setGeometry(wrapper, { bar: 1000, list: 1000, content: 1000 });
        window.dispatchEvent(new Event('resize'));
        await settle();
        const gutters = wrapper.findAll('[data-nav-gutter]');
        expect(gutters).toHaveLength(2);
        for (const gutter of gutters) {
          expect(gutter.element.children.length).toBe(0);
        }
      });

      it('shows both arrows on overflow, the back one disabled at the start', async () => {
        const { wrapper } = await mountOverflowing();
        const back = wrapper.find(BACK);
        const forward = wrapper.find(FORWARD);

        expect(back.exists()).toBe(true);
        expect(forward.exists()).toBe(true);
        expect(back.attributes()).toHaveProperty('disabled');
        expect(forward.attributes()).not.toHaveProperty('disabled');
      });

      it('keeps the arrows out of the tab order and the accessibility tree', async () => {
        // Mouse aids only: Tab reaches every link, a screen reader reads them all.
        const { wrapper } = await mountOverflowing();
        for (const selector of [BACK, FORWARD]) {
          const button = wrapper.find(selector);
          expect(button.attributes('type')).toBe('button');
          expect(button.attributes('tabindex')).toBe('-1');
          expect(button.attributes('aria-hidden')).toBe('true');
        }
      });

      it('dims the forward arrow at the end, keeping both arrows', async () => {
        const { wrapper, list } = await mountOverflowing();
        list.scrollLeft = 680;
        list.dispatchEvent(new Event('scroll'));
        await settle();

        expect(wrapper.find(BACK).attributes()).not.toHaveProperty('disabled');
        expect(wrapper.find(FORWARD).attributes()).toHaveProperty('disabled');
      });

      it('does not count the focus-ring padding as overflow', async () => {
        mockMenu.value = manyItems();
        // happy-dom computes no style for a detached element.
        const wrapper = shallowMountComponent(LayoutHeaderNav, {
          ...mountOptions,
          attachTo: document.body,
        });
        const list = setGeometry(wrapper, {
          bar: 1000,
          list: 1006,
          content: 1006,
        });
        list.style.paddingLeft = '3px';
        list.style.paddingRight = '3px';
        window.dispatchEvent(new Event('resize'));
        await settle();
        expect(wrapper.find(FORWARD).exists()).toBe(false);

        setGeometry(wrapper, { bar: 1000, list: 1006, content: 1007 });
        window.dispatchEvent(new Event('resize'));
        await settle();
        expect(wrapper.find(FORWARD).exists()).toBe(true);
        wrapper.unmount();
      });

      it('decides overflow from the room the bar gives the list', async () => {
        // The bar is 1000 wide; 950 of content fits it even though the list
        // reports a narrower clientWidth.
        const { wrapper } = await mountOverflowing();
        setGeometry(wrapper, { bar: 1000, list: 920, content: 950 });
        window.dispatchEvent(new Event('resize'));
        await settle();

        expect(wrapper.find(BACK).exists()).toBe(false);
        expect(wrapper.find(FORWARD).exists()).toBe(false);
      });

      it('does not re-decide overflow while scrolling', async () => {
        const { wrapper, list } = await mountOverflowing();
        // Content that would fit, but only a resize may act on it.
        setGeometry(wrapper, { bar: 1000, list: 920, content: 900 });
        list.dispatchEvent(new Event('scroll'));
        await settle();

        expect(wrapper.find(BACK).exists()).toBe(true);
        expect(wrapper.find(FORWARD).exists()).toBe(true);
      });

      /**
       * Lays the items out in a row: 200 wide, 8 apart, the list showing
       * 100..1020 and scrolled by `list.scrollLeft`. `scrollBy` moves it,
       * clamped like a browser, so clicks can be counted to the end.
       */
      function layOut(list: HTMLElement, itemWidth = 200) {
        const items = Array.from(list.children) as HTMLElement[];
        const max = items.length * (itemWidth + 8) - 8 - 920;
        Object.defineProperty(list, 'scrollWidth', {
          configurable: true,
          value: max + 920,
        });
        list.getBoundingClientRect = () => new DOMRect(100, 0, 920, 44);
        items.forEach((item, i) => {
          item.getBoundingClientRect = () =>
            new DOMRect(
              100 + i * (itemWidth + 8) - list.scrollLeft,
              0,
              itemWidth,
              36,
            );
        });
        const scrollBy = vi.fn((opts: ScrollToOptions) => {
          list.scrollLeft = Math.min(
            max,
            Math.max(0, list.scrollLeft + (opts.left ?? 0)),
          );
          list.dispatchEvent(new Event('scroll'));
        });
        list.scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
        return { scrollBy, max };
      }

      it('pages forward so the last fully visible item leads the next view', async () => {
        const { wrapper, list } = await mountOverflowing();
        const { scrollBy } = layOut(list);

        await wrapper.find(FORWARD).trigger('click');

        // Items 0-3 are whole, item 4 (932..1132) is cut. Item 3 starts at 724
        // and becomes the first in view, so item 4 shows whole beside it.
        expect(scrollBy).toHaveBeenCalledWith({
          left: 624,
          behavior: 'smooth',
        });
      });

      it('pages back so the first fully visible item ends the previous view', async () => {
        const { wrapper, list } = await mountOverflowing(1000);
        list.dispatchEvent(new Event('scroll'));
        await settle();
        const { scrollBy } = layOut(list);

        await wrapper.find(BACK).trigger('click');

        // Item 4 (-68..132) is cut; item 5 (140..340) is the first whole one
        // and moves to the right edge.
        expect(scrollBy).toHaveBeenCalledWith({
          left: -680,
          behavior: 'smooth',
        });
      });

      it('still moves on when one item is wider than the bar', async () => {
        const { wrapper, list } = await mountOverflowing();
        const { scrollBy } = layOut(list, 1000);

        await wrapper.find(FORWARD).trigger('click');

        // No item is whole; the next one to start inside the bar leads instead.
        expect(scrollBy).toHaveBeenCalledWith({
          left: 1008,
          behavior: 'smooth',
        });
      });

      it('still moves back when one item is wider than the bar', async () => {
        const { wrapper, list } = await mountOverflowing(1008);
        list.dispatchEvent(new Event('scroll'));
        await settle();
        const { scrollBy } = layOut(list, 1000);

        await wrapper.find(BACK).trigger('click');

        // Item 1 (100..1100) is the first to start inside but does not fit;
        // item 0 (-908..92), the last to end inside, moves to the right edge.
        expect(scrollBy).toHaveBeenCalledWith({
          left: -928,
          behavior: 'smooth',
        });
      });

      it('pages to the content edge, leaving the focus-ring padding empty', async () => {
        // The list's 3px padding is room for focus rings, so a paged item lands
        // 3px in from the list's box, where the first item sits at scroll 0.
        mockMenu.value = manyItems();
        const wrapper = shallowMountComponent(LayoutHeaderNav, {
          ...mountOptions,
          attachTo: document.body,
        });
        const list = setGeometry(wrapper, {
          bar: 1000,
          list: 920,
          content: 1600,
        });
        list.style.paddingLeft = '3px';
        list.style.paddingRight = '3px';
        window.dispatchEvent(new Event('resize'));
        await settle();
        const { scrollBy } = layOut(list);

        await wrapper.find(FORWARD).trigger('click');

        // Item 3 starts at 724; the content edge is 103, not 100.
        expect(scrollBy).toHaveBeenCalledWith({
          left: 621,
          behavior: 'smooth',
        });
        wrapper.unmount();
      });

      it('paints the bar background over a gutter only while items are scrolled under it', async () => {
        // The list's focus-ring padding reaches 3px into each gutter, so a
        // scrolled-off label would show a sliver next to the arrow. At an end
        // the gutter stays transparent, so the edge item's focus ring shows.
        const { wrapper, list } = await mountOverflowing();
        const gutter = (side: string) =>
          wrapper.find(`[data-nav-gutter="${side}"]`).classes();
        // Plain-link items are positioned, so the gutter needs a z-index to
        // paint over them; the row isolates it from the rest of the header.
        const solid = ['relative', 'z-10', 'bg-nav-bar-background'];
        const row = wrapper.find('[data-nav-gutter="start"]').element
          .parentElement;
        expect(row?.classList.contains('isolate')).toBe(true);

        expect(gutter('start')).not.toEqual(expect.arrayContaining(solid));
        expect(gutter('end')).toEqual(expect.arrayContaining(solid));

        list.scrollLeft = 300;
        list.dispatchEvent(new Event('scroll'));
        await settle();
        expect(gutter('start')).toEqual(expect.arrayContaining(solid));
        expect(gutter('end')).toEqual(expect.arrayContaining(solid));

        list.scrollLeft = 680;
        list.dispatchEvent(new Event('scroll'));
        await settle();
        expect(gutter('start')).toEqual(expect.arrayContaining(solid));
        expect(gutter('end')).not.toEqual(expect.arrayContaining(solid));
      });

      it('reaches the end of a menu almost three bars long in three clicks', async () => {
        const { wrapper, list } = await mountOverflowing();
        const { scrollBy, max } = layOut(list);

        for (let i = 0; i < 3; i++) {
          await settle();
          await wrapper.find(FORWARD).trigger('click');
        }
        await settle();

        expect(scrollBy).toHaveBeenCalledTimes(3);
        expect(list.scrollLeft).toBe(max);
        expect(wrapper.find(FORWARD).attributes()).toHaveProperty('disabled');
      });

      it('jumps instead of gliding when the visitor prefers reduced motion', async () => {
        const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
          (query: string) =>
            ({
              matches: query.includes('reduce'),
              media: query,
              onchange: null,
              addEventListener: () => {},
              removeEventListener: () => {},
              addListener: () => {},
              removeListener: () => {},
              dispatchEvent: () => false,
            }) as MediaQueryList,
        );
        try {
          const { wrapper, list } = await mountOverflowing();
          const { scrollBy } = layOut(list);

          await wrapper.find(FORWARD).trigger('click');

          expect(scrollBy).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'auto' }),
          );
        } finally {
          matchMedia.mockRestore();
        }
      });
    });

    describe('mouse wheel', () => {
      it('turns a vertical wheel over the bar into a sideways scroll', async () => {
        const { wrapper, list } = await mountOverflowing();
        const event = wheel(topLink(wrapper), { deltaY: 120 });

        expect(event.defaultPrevented).toBe(true);
        expect(list.scrollLeft).toBe(120);
      });

      it('turns line-mode wheel deltas into pixels', async () => {
        // Firefox can report the wheel in lines rather than pixels.
        const { wrapper, list } = await mountOverflowing();
        wheel(topLink(wrapper), { deltaY: 3, deltaMode: 1 });
        expect(list.scrollLeft).toBe(48);
      });

      it('leaves the wheel to the page when the items fit', async () => {
        mockMenu.value = manyItems();
        const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
        const list = setGeometry(wrapper, {
          bar: 1000,
          list: 1000,
          content: 1000,
        });
        window.dispatchEvent(new Event('resize'));
        await settle();
        const event = wheel(topLink(wrapper), { deltaY: 120 });

        expect(event.defaultPrevented).toBe(false);
        expect(list.scrollLeft).toBe(0);
      });

      it('leaves shift+wheel and trackpad sideways swipes to the browser', async () => {
        const { wrapper, list } = await mountOverflowing();
        const link = topLink(wrapper);

        expect(
          wheel(link, { deltaY: 120, shiftKey: true }).defaultPrevented,
        ).toBe(false);
        expect(wheel(link, { deltaX: 80, deltaY: 10 }).defaultPrevented).toBe(
          false,
        );
        expect(list.scrollLeft).toBe(0);
      });

      it('leaves the wheel to an open mega menu', async () => {
        const { wrapper, list } = await mountOverflowing();
        const panel = wrapper.find('[data-slot="navigation-menu-content"] a');
        const event = wheel(panel.element, { deltaY: 120 });

        expect(event.defaultPrevented).toBe(false);
        expect(list.scrollLeft).toBe(0);
      });

      it('lets the page scroll once the bar is at its end', async () => {
        const { wrapper, list } = await mountOverflowing(680);
        const link = topLink(wrapper);

        expect(wheel(link, { deltaY: 120 }).defaultPrevented).toBe(false);
        expect(list.scrollLeft).toBe(680);
        list.scrollLeft = 0;
        expect(wheel(link, { deltaY: -120 }).defaultPrevented).toBe(false);
      });
    });

    it('scrolls a focused item fully into view', async () => {
      // Chromium leaves a partly visible focused element where it is.
      const { wrapper, list } = await mountOverflowing();
      list.getBoundingClientRect = () => new DOMRect(100, 0, 920, 44);
      const link = topLink(wrapper);
      link.getBoundingClientRect = () => new DOMRect(980, 0, 100, 36);

      link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(list.scrollLeft).toBe(60);
    });

    it('scrolls back to a focused item cut off on the left', async () => {
      // Shift+Tab walks the links leftwards.
      const { wrapper, list } = await mountOverflowing(300);
      list.getBoundingClientRect = () => new DOMRect(100, 0, 920, 44);
      const link = topLink(wrapper);
      link.getBoundingClientRect = () => new DOMRect(40, 0, 100, 36);

      link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(list.scrollLeft).toBe(240);
    });

    it('scrolls a focused item to the content edge, past the focus-ring padding', async () => {
      mockMenu.value = manyItems();
      const wrapper = shallowMountComponent(LayoutHeaderNav, {
        ...mountOptions,
        attachTo: document.body,
      });
      const list = setGeometry(wrapper, {
        bar: 1000,
        list: 920,
        content: 1600,
        scrollLeft: 300,
      });
      list.style.paddingLeft = '3px';
      list.style.paddingRight = '3px';
      window.dispatchEvent(new Event('resize'));
      await settle();
      list.getBoundingClientRect = () => new DOMRect(100, 0, 920, 44);
      const link = topLink(wrapper);

      link.getBoundingClientRect = () => new DOMRect(980, 0, 100, 36);
      link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(list.scrollLeft).toBe(363);

      link.getBoundingClientRect = () => new DOMRect(40, 0, 100, 36);
      link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(list.scrollLeft).toBe(300);
      wrapper.unmount();
    });

    it('leaves the bar alone when focus moves into a mega menu', async () => {
      // The panel spans the viewport, so its links sit far outside the list.
      const { wrapper, list } = await mountOverflowing();
      list.getBoundingClientRect = () => new DOMRect(100, 0, 920, 44);
      const panelLink = wrapper.find('[data-slot="navigation-menu-content"] a')
        .element as HTMLElement;
      panelLink.getBoundingClientRect = () => new DOMRect(1100, 200, 100, 36);

      panelLink.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

      expect(list.scrollLeft).toBe(0);
    });
  });

  it('always paints bg-nav-bar-background (tenant theme drives colour, with var(--muted) fallback)', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [{ id: '1', label: 'Item', order: 1 }],
    };
    for (const variant of ['grey', 'white'] as const) {
      const wrapper = shallowMountComponent(LayoutHeaderNav, {
        ...mountOptions,
        props: { variant },
      });
      const nav = wrapper.find('nav');
      expect(nav.classes()).toContain('bg-nav-bar-background');
      expect(nav.classes()).not.toContain('bg-muted');
      expect(nav.classes()).not.toContain('bg-background');
    }
  });

  it('is hidden on mobile (lg:flex)', () => {
    mockMenu.value = {
      id: '1',
      title: 'Main',
      menuItems: [{ id: '1', label: 'Item', order: 1 }],
    };
    const wrapper = shallowMountComponent(LayoutHeaderNav, mountOptions);
    const nav = wrapper.find('nav');
    expect(nav.classes()).toContain('hidden');
    expect(nav.classes()).toContain('lg:flex');
  });
});
