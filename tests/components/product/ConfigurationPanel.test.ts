import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type { AuthUser } from '@geins/types';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { mountComponent } from '../../utils/component';
import ConfigurationPanel from '../../../app/components/product/configurator/ConfigurationPanel.vue';
import { useTenant } from '../../../app/composables/useTenant';
import { useAuthStore } from '../../../app/stores/auth';
import {
  findOption,
  findOptionGroup,
  makeInvalidConfiguration,
  makeValidConfiguration,
} from '../../fixtures/configurator';

// Escapes the tier-wide mock, which answers true for every key; see
// tests/setup-components.ts. Without it `canUnlockByAuth` is always false and
// the sign-in state cannot be reached at all.
vi.unmock('../../../app/composables/useFeatureAccess');

// The tier's passthrough `t` substitutes a parameter only where the key itself
// happens to contain its placeholder, so a count never reaches the rendered
// text and nothing here could prove it is passed through. This one appends the
// parameters instead.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    locale: ref('en'),
  }),
}));

// The sheet's content inline rather than in a portal, keeping the `open` gate:
// a closed sheet renders nothing, as the real one does. The tooltip's content
// inline and always there, so the label it carries can be read.
vi.mock('../../../app/components/ui/sheet', () => ({
  Sheet: {
    template: '<div><slot v-if="open" /></div>',
    props: ['open'],
  },
  SheetContent: {
    template: '<div data-testid="configurator-spec-sheet"><slot /></div>',
    props: ['side'],
  },
  SheetHeader: { template: '<div><slot /></div>' },
  SheetTitle: { template: '<h2 data-testid="sheet-title"><slot /></h2>' },
  SheetDescription: {
    template: '<p data-testid="sheet-description"><slot /></p>',
  },
}));

vi.mock('../../../app/components/ui/tooltip', () => ({
  TooltipProvider: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  TooltipTrigger: { template: '<div><slot /></div>' },
  TooltipContent: {
    template: '<span data-testid="tooltip"><slot /></span>',
  },
}));

const { tenant } = useTenant();

function setFeatures(features: PublicTenantConfig['features']) {
  assert.isDefined(tenant.value);
  tenant.value.features = features;
}

// `isAuthenticated` is `!!user.value`, so identity is all this needs to carry.
const SIGNED_IN: AuthUser = { userId: '1', username: 'buyer@example.com' };

// Intl separates the amount from the currency with a non-breaking space, so
// every comparison against a written-out price goes through this.
function plainText(text: string): string {
  return text.replace(/\u00a0/g, ' ');
}

function mountPanel(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  return mountComponent(ConfigurationPanel, {
    slots,
    props: {
      configuration: makeValidConfiguration(),
      status: 'active',
      busy: false,
      productName: 'Arbetsbord Pro',
      articleNumber: 'KONF-1001',
      ...props,
    },
  });
}

describe('ConfigurationPanel', () => {
  beforeEach(() => {
    setFeatures({});
    // The Pinia store is shared across this file's tests.
    useAuthStore().user = null;
  });

  describe('before a document arrives', () => {
    const empty = (wrapper: ReturnType<typeof mountPanel>) =>
      wrapper.findAll('[data-testid="configurator-card-empty"]');

    it('renders the header over one empty body, with no text and nothing in it', () => {
      const wrapper = mountPanel({ configuration: null, status: 'idle' });

      expect(
        wrapper.find('[data-testid="configurator-panel-header"]').text(),
      ).toBe('configurator.panel.title');
      // One block, so the card's dividers draw nothing inside it.
      expect(empty(wrapper)).toHaveLength(1);
      expect(empty(wrapper)[0]!.element.children).toHaveLength(0);
      expect(wrapper.text()).toBe('configurator.panel.title');
    });

    const top = (wrapper: ReturnType<typeof mountPanel>) =>
      wrapper.findAll('[data-testid="configurator-card-top-empty"]');

    it('holds the space of the price, the action and the session above the header', () => {
      // Measured on the loaded box: price 90, action 65, session 57, each
      // carrying the divider under it. One block, so no dividers inside.
      const shown = mountPanel({ configuration: null, status: 'idle' });
      setFeatures({ priceVisibility: { enabled: false } });
      const hidden = mountPanel({ configuration: null, status: 'idle' });

      expect(top(shown)).toHaveLength(1);
      expect(top(shown)[0]!.classes()).toEqual(['h-[212px]', 'shrink-0']);
      expect(top(shown)[0]!.element.children).toHaveLength(0);
      expect(top(hidden)[0]!.classes()).toEqual(['h-[122px]', 'shrink-0']);

      const spec = shown.find('[data-testid="configurator-panel-spec"]');
      expect(
        top(shown)[0]!.element.compareDocumentPosition(spec.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(spec.element.contains(top(shown)[0]!.element)).toBe(false);
    });

    it('holds no top space once the document is there, nor for an expired session', () => {
      expect(top(mountPanel())).toHaveLength(0);
      expect(
        top(mountPanel({ configuration: null, status: 'expired' })),
      ).toHaveLength(0);
    });

    it("holds the loaded sections' height, less the price where none shows", () => {
      const shown = mountPanel({ configuration: null, status: 'idle' });
      setFeatures({ priceVisibility: { enabled: false } });
      const hidden = mountPanel({ configuration: null, status: 'idle' });

      // Bookcase, 1440 wide: the loaded specification is its 45 px header
      // over 265 of rows and an 85 px price. From lg the box is capped under
      // the sticky offset, so the body is too: 192 offset, 16 air, the card's
      // two borders, the top space and the header.
      expect(empty(shown)[0]!.classes()).toEqual([
        'min-h-[350px]',
        'lg:min-h-[min(350px,calc(100vh-467px))]',
      ]);
      expect(empty(hidden)[0]!.classes()).toEqual([
        'min-h-[265px]',
        'lg:min-h-[min(265px,calc(100vh-377px))]',
      ]);
    });

    it('renders no empty body once the document is there', () => {
      expect(empty(mountPanel())).toHaveLength(0);
    });

    it('renders no empty body for an expired session', () => {
      const wrapper = mountPanel({ configuration: null, status: 'expired' });
      expect(empty(wrapper)).toHaveLength(0);
    });
  });

  describe('the box', () => {
    const SLOT = { default: '<div data-testid="slot-probe" />' };

    function follows(a: Element, b: Element): boolean {
      return !!(
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    }

    it('puts the price on top, then the slot, then the specification', () => {
      const wrapper = mountPanel({ busy: true }, SLOT);
      const price = wrapper.find('[data-testid="configurator-panel-price"]');
      const probe = wrapper.find('[data-testid="slot-probe"]');
      const spec = wrapper.find('[data-testid="configurator-panel-spec"]');

      expect(follows(price.element, probe.element)).toBe(true);
      expect(follows(probe.element, spec.element)).toBe(true);
      // The slot is the page's: the panel only gives it its place.
      expect(spec.element.contains(probe.element)).toBe(false);
    });

    it('scrolls the rows inside the specification, under its header', () => {
      const spec = mountPanel().find('[data-testid="configurator-panel-spec"]');
      expect(spec.classes()).toEqual(
        expect.arrayContaining(['flex', 'min-h-0', 'flex-col']),
      );
      const rows = spec.find('[data-testid="configurator-panel-rows"]');
      expect(rows.classes()).toEqual(
        expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
      );
      const header = spec.find('[data-testid="configurator-panel-header"]');
      expect(header.classes()).toContain('shrink-0');
      expect(follows(header.element, rows.element)).toBe(true);
    });

    it('repeats the price at the foot of the specification, smaller', () => {
      const wrapper = mountPanel();
      const spec = wrapper.find('[data-testid="configurator-panel-spec"]');
      const foot = spec.find('[data-testid="configurator-spec-price"]');
      const rows = spec.find('[data-testid="configurator-panel-rows"]');

      expect(follows(rows.element, foot.element)).toBe(true);
      expect(foot.classes()).toContain('shrink-0');
      expect(plainText(foot.text())).toContain('SEK 3,200.00');
      expect(
        wrapper.find('[data-testid="configurator-panel-net"]').classes(),
      ).toContain('text-xl');
      expect(
        foot.find('[data-testid="configurator-spec-net"]').classes(),
      ).toContain('text-base');
      // The summary on top stays outside the specification.
      expect(
        spec.find('[data-testid="configurator-panel-price"]').exists(),
      ).toBe(false);
    });

    it('drops both prices where the buyer may not see one', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountPanel();
      expect(
        wrapper.find('[data-testid="configurator-panel-price"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="configurator-spec-price"]').exists(),
      ).toBe(false);
    });

    it('keeps the loading state the header over one empty body, in the specification', () => {
      const wrapper = mountPanel({ configuration: null, status: 'idle' });
      const spec = wrapper.find('[data-testid="configurator-panel-spec"]');
      expect(
        spec.find('[data-testid="configurator-panel-header"]').exists(),
      ).toBe(true);
      expect(
        spec.find('[data-testid="configurator-card-empty"]').exists(),
      ).toBe(true);
      expect(
        wrapper.find('[data-testid="configurator-panel-expand"]').exists(),
      ).toBe(false);
      expect(
        wrapper.find('[data-testid="configurator-panel-copy"]').exists(),
      ).toBe(false);
    });
  });

  describe('expand', () => {
    it('is an icon button in the header, labelled by its tooltip', () => {
      const header = mountPanel().find(
        '[data-testid="configurator-panel-header"]',
      );
      const expand = header.find('[data-testid="configurator-panel-expand"]');
      expect(expand.element.tagName).toBe('BUTTON');
      expect(expand.attributes('aria-label')).toBe('configurator.panel.expand');
      expect(
        header.findAll('[data-testid="tooltip"]').map((t) => t.text()),
      ).toContain('configurator.panel.expand');
    });

    it('opens nothing until it is pressed', () => {
      expect(
        mountPanel().find('[data-testid="configurator-spec-sheet"]').exists(),
      ).toBe(false);
    });

    it('opens the whole specification in a sheet, with the price', async () => {
      const wrapper = mountPanel();
      await wrapper
        .find('[data-testid="configurator-panel-expand"]')
        .trigger('click');
      const sheet = wrapper.find('[data-testid="configurator-spec-sheet"]');

      expect(sheet.find('[data-testid="sheet-title"]').text()).toBe(
        'configurator.panel.title',
      );
      expect(sheet.find('[data-testid="sheet-description"]').text()).toBe(
        'Arbetsbord Pro',
      );
      expect(sheet.findAll('h4').map((h) => h.text())).toEqual([
        'Frame',
        'Finish',
      ]);
      expect(sheet.findAll('dt').map((term) => term.text())).toEqual([
        'Leg frame',
        'Width',
        'Depth',
        'Table top',
        'Colour',
      ]);
      expect(sheet.text()).toContain('Fixed height legs');
      expect(
        plainText(sheet.find('[data-testid="configurator-sheet-net"]').text()),
      ).toBe('SEK 3,200.00');
      expect(
        sheet.findAll('[data-testid="configurator-sheet-price-row"]'),
      ).toHaveLength(3);
    });

    it('writes the sheet larger than the column, group headings on a muted band', async () => {
      const wrapper = mountPanel();
      await wrapper
        .find('[data-testid="configurator-panel-expand"]')
        .trigger('click');
      const sheet = wrapper.find('[data-testid="configurator-spec-sheet"]');

      expect(sheet.find('h4').classes()).toEqual(
        expect.arrayContaining(['bg-muted', 'text-sm']),
      );
      expect(sheet.find('dt').classes()).toContain('text-sm');
      expect(
        sheet.find('[data-testid="configurator-sheet-net"]').classes(),
      ).toContain('text-xl');
    });

    it('leaves the price out of the sheet where the buyer may not see one', async () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountPanel();
      await wrapper
        .find('[data-testid="configurator-panel-expand"]')
        .trigger('click');
      expect(
        wrapper.find('[data-testid="configurator-sheet-net"]').exists(),
      ).toBe(false);
    });
  });

  describe('header', () => {
    it('names the specification and nothing else', () => {
      useAuthStore().user = { ...SIGNED_IN, customerType: 'ORGANIZATION' };
      const header = mountPanel().find(
        '[data-testid="configurator-panel-header"]',
      );
      // The title, then the two icons and nothing else.
      expect(header.find('h3').text()).toBe('configurator.panel.title');
      expect(header.text()).not.toContain('KONF-1001');
      expect(
        header.findAll('button').map((b) => b.attributes('data-testid')),
      ).toEqual(['configurator-panel-expand']);
    });
  });

  describe('specification', () => {
    it('groups the choices under the section they were made in', () => {
      const rows = mountPanel().find('[data-testid="configurator-panel-rows"]');
      expect(rows.findAll('h4').map((heading) => heading.text())).toEqual([
        'Frame',
        'Finish',
      ]);
    });

    it('writes each choice as its label and its value', () => {
      const rows = mountPanel().find('[data-testid="configurator-panel-rows"]');
      expect(rows.findAll('dt').map((term) => term.text())).toEqual([
        'Leg frame',
        'Width',
        'Depth',
        'Table top',
        'Colour',
      ]);
      expect(rows.text()).toContain('Fixed height legs');
      // Written the way the field writes it: grouped for the locale, with the
      // unit beside it.
      expect(rows.text()).toContain('1,200 mm');
    });

    it('writes a measurement with the decimals the provider asked for', () => {
      const config = makeValidConfiguration();
      const width = config.sections[0]!.variables.find((v) => v.id === 'width');
      assert.isDefined(width);
      width.decimals = 1;
      width.value = 12.5;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(rows.text()).toContain('12.5 mm');
    });

    it('annotates a choice that costs something and says nothing where it costs nothing', () => {
      const config = makeValidConfiguration();
      findOption(config, 'legs-fixed').selected = false;
      findOption(config, 'legs-electric').selected = true;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(plainText(rows.text())).toContain('+SEK 4,200.00');
      // The laminate top and black are included in the base price; a column of
      // zeroes would say only that.
      expect(plainText(rows.text())).not.toContain('SEK 0.00');
    });

    it('states how many of an option were chosen, above one', () => {
      const config = makeValidConfiguration();
      const power = findOption(config, 'acc-power');
      power.selected = true;
      power.quantity = 3;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(rows.text()).toContain(
        'Power strip · configurator.panel.quantity_suffix 3',
      );
      expect(rows.text()).toContain('Fixed height legs');
      expect(rows.text()).not.toContain(
        'Fixed height legs · configurator.panel.quantity_suffix 1',
      );
    });

    it('hides a price the buyer may not see, keeping the choice itself', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const config = makeValidConfiguration();
      findOption(config, 'legs-fixed').selected = false;
      findOption(config, 'legs-electric').selected = true;

      const rows = mountPanel({ configuration: config }).find(
        '[data-testid="configurator-panel-rows"]',
      );
      expect(rows.text()).toContain('Electric height legs');
      expect(plainText(rows.text())).not.toContain('4,200');
    });
  });

  describe('price', () => {
    it('renders the unit price of the document', () => {
      const wrapper = mountPanel();
      // The tier's locale is 'en', so this is Intl's English shape for SEK.
      expect(
        plainText(
          wrapper.find('[data-testid="configurator-panel-price"]').text(),
        ),
      ).toContain('SEK 3,200.00');
    });

    it('takes the currency from the document rather than a default', () => {
      const config = makeValidConfiguration();
      config.unitPrice = { sellingPriceExVat: 1000, currency: { code: 'EUR' } };
      const wrapper = mountPanel({ configuration: config });
      expect(
        plainText(
          wrapper.find('[data-testid="configurator-panel-price"]').text(),
        ),
      ).toContain('€1,000.00');
    });

    it('leaves the indicative note to the copied text', () => {
      expect(
        mountPanel().find('[data-testid="configurator-panel-price"]').text(),
      ).not.toContain('configurator.panel.indicative');
    });

    it('names the quantity only when more than one is being configured', () => {
      const price = () =>
        mountPanel().find('[data-testid="configurator-panel-price"]').text();
      expect(price()).not.toContain('configurator.panel.quantity_suffix');

      const config = makeValidConfiguration();
      config.quantity = 4;
      expect(
        mountPanel({ configuration: config })
          .find('[data-testid="configurator-panel-price"]')
          .text(),
      ).toContain('configurator.panel.quantity_suffix 4');
    });

    it('shows a discounted price as it arrives, with no percentage and nothing struck through', () => {
      // `unitPrice` already has the discount taken off; taking it off again
      // would show 2,400 against the 3,200 commit freezes. The prototype's
      // total carries neither a badge nor a struck price.
      const config = makeValidConfiguration();
      config.discountPercent = 25;
      config.unitPrice = {
        ...config.unitPrice,
        regularPriceExVat: 4266.67,
        isDiscounted: true,
      };

      const wrapper = mountPanel({ configuration: config });
      const price = plainText(
        wrapper.find('[data-testid="configurator-panel-price"]').text(),
      );
      expect(price).toContain('SEK 3,200.00');
      expect(price).not.toContain('SEK 2,400.00');
      expect(price).not.toContain('4,266.67');
      expect(price).not.toContain('25%');
      expect(wrapper.find('.line-through').exists()).toBe(false);
    });

    it('writes net, VAT and the total in that order, as the prototype', () => {
      const wrapper = mountPanel();

      const rows = wrapper
        .findAll('[data-testid="configurator-panel-price-row"]')
        .map((row) => plainText(row.text()));

      expect(rows).toHaveLength(3);
      expect(rows[0]).toContain('configurator.panel.net_price');
      expect(rows[0]).toContain('SEK 3,200.00');
      expect(rows[1]).toContain('configurator.panel.vat 25');
      expect(rows[1]).toContain('SEK 800.00');
      expect(rows[2]).toContain('configurator.panel.inc_vat');
      expect(rows[2]).toContain('SEK 4,000.00');
    });

    it('leads with the net figure', () => {
      expect(
        plainText(
          mountPanel().find('[data-testid="configurator-panel-net"]').text(),
        ),
      ).toBe('SEK 3,200.00');
    });

    it('reads every row from the price as sent, never from each other', () => {
      // Amounts that do not add up prove no row is derived from another.
      const config = makeValidConfiguration();
      config.unitPrice = {
        sellingPriceExVat: 1000,
        sellingPriceIncVat: 1300,
        vat: 120,
        currency: { code: 'SEK' },
      };

      const rows = mountPanel({ configuration: config })
        .findAll('[data-testid="configurator-panel-price-row"]')
        .map((row) => plainText(row.text()));

      expect(rows[0]).toContain('SEK 1,000.00');
      expect(rows[1]).toContain('configurator.panel.vat 12');
      expect(rows[1]).toContain('SEK 120.00');
      expect(rows[2]).toContain('SEK 1,300.00');
    });

    it('writes all three rows at zero for a price of zero, VAT without a rate', () => {
      const config = makeValidConfiguration();
      config.unitPrice = {
        sellingPriceExVat: 0,
        sellingPriceIncVat: 0,
        vat: 0,
        currency: { code: 'SEK' },
      };

      const rows = mountPanel({ configuration: config })
        .findAll('[data-testid="configurator-panel-price-row"]')
        .map((row) => plainText(row.text()));

      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.includes('SEK 0.00'))).toBe(true);
      expect(rows[1]).toContain('configurator.panel.vat_no_rate');
      expect(rows[1]).not.toContain('configurator.panel.vat ');
    });
  });

  // One test per configured value of `priceVisibility`, each writing the value
  // and asserting what the panel does with it.
  describe('priceVisibility', () => {
    it('shows the price when priceVisibility is absent from features', () => {
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('shows the price when priceVisibility is enabled with no access rule', () => {
      setFeatures({ priceVisibility: { enabled: true } });
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('renders no price block when priceVisibility is disabled', () => {
      // Nothing the buyer can do reveals it; the sign-in offer is the action's,
      // and it makes none either.
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountPanel();
      expect(
        wrapper.find('[data-testid="configurator-panel-price"]').exists(),
      ).toBe(false);
    });

    it('shows the price when priceVisibility access is open to all', () => {
      setFeatures({ priceVisibility: { enabled: true, access: 'all' } });
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('hides the price when priceVisibility requires authentication and the user is anonymous', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).not.toContain('SEK 3,200.00');
    });

    it('shows the price when priceVisibility requires authentication and the user is signed in', () => {
      setFeatures({
        priceVisibility: { enabled: true, access: 'authenticated' },
      });
      useAuthStore().user = SIGNED_IN;
      const wrapper = mountPanel();
      expect(plainText(wrapper.text())).toContain('SEK 3,200.00');
    });

    it('still renders the specification when the price is hidden', () => {
      setFeatures({ priceVisibility: { enabled: false } });
      const wrapper = mountPanel();
      expect(wrapper.text()).toContain('Fixed height legs');
    });
  });

  describe('validity', () => {
    // What is missing is listed under the section rail, by the page.
    it('lists nothing that is missing, complete or not', () => {
      for (const configuration of [
        makeValidConfiguration(),
        makeInvalidConfiguration(),
      ]) {
        const wrapper = mountPanel({ configuration });
        expect(
          wrapper.find('[data-testid="configurator-panel-rows"]').exists(),
        ).toBe(true);
        expect(wrapper.text()).not.toMatch(/configurator\.panel\.(in)?valid/);
        expect(wrapper.find('[data-testid*="missing"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid*="validity"]').exists()).toBe(false);
      }
    });
  });

  describe('recomputing', () => {
    // The action says it is busy; a line of its own above it was clutter.
    it.each([false, true])('renders no recomputing line, busy: %s', (busy) => {
      const wrapper = mountPanel({ busy });
      expect(
        wrapper.find('[data-testid="configurator-panel-busy"]').exists(),
      ).toBe(false);
      expect(wrapper.text()).not.toContain('configurator.panel.recomputing');
    });
  });

  describe('copy', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'clipboard');
      Reflect.deleteProperty(navigator, 'permissions');
    });

    function grantClipboard() {
      const writeText = vi.fn().mockResolvedValue(undefined);
      // jsdom has neither a clipboard nor a permission to write to it, and
      // without both `useClipboard` reports the feature unsupported, renders
      // no button, and writes nothing when one is pressed.
      // Defined on the real navigator rather than stubbed as a global: VueUse
      // captures `window.navigator` when the module is loaded, so a global
      // replaced afterwards is one it never reads. Deleted again in afterEach:
      // the tier runs without isolation, so a clipboard left behind is one
      // every later file in this worker would see.
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: vi.fn().mockResolvedValue({
            state: 'granted',
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }),
        },
        configurable: true,
      });
      return writeText;
    }

    async function copyText(wrapper: ReturnType<typeof mountPanel>) {
      await flushPromises();
      await wrapper
        .find('[data-testid="configurator-panel-copy"]')
        .trigger('click');
      await flushPromises();
    }

    it('copies the specification as plain text', async () => {
      const writeText = grantClipboard();

      const wrapper = mountPanel();
      await flushPromises();
      const button = wrapper.find('[data-testid="configurator-panel-copy"]');
      expect(button.exists()).toBe(true);
      expect(button.attributes('aria-label')).toBe('configurator.panel.copy');
      expect(
        button.element.closest('[data-testid="configurator-panel-header"]'),
      ).not.toBeNull();
      await button.trigger('click');
      await flushPromises();

      // An icon alone: the label and the tooltip say what it does, and what
      // it did. The confirmation is the success colour rather than the
      // button's own.
      expect(button.text()).toBe('');
      expect(button.attributes('aria-label')).toBe('configurator.panel.copied');
      expect(button.find('.text-success').exists()).toBe(true);
      expect(
        wrapper
          .find('[data-testid="configurator-panel-header"]')
          .findAll('[data-testid="tooltip"]')
          .map((t) => t.text()),
      ).toContain('configurator.panel.copied');

      const copied = writeText.mock.calls[0]?.[0] as string;
      expect(copied).toContain('Arbetsbord Pro (KONF-1001)');
      expect(copied).toContain('configurator.panel.indicative');
      expect(copied).toContain('FRAME');
      expect(copied).toContain('  Colour:');
      expect(copied).toContain('Black (RAL 9005)');
      // The same three price lines the panel shows, in its order.
      const lines = copied.split('\n').map(plainText);
      const net = lines.indexOf('configurator.panel.net_price: SEK 3,200.00');
      expect(net).toBeGreaterThanOrEqual(0);
      expect(lines[net + 1]).toBe('configurator.panel.vat 25: SEK 800.00');
      expect(lines[net + 2]).toBe('configurator.panel.inc_vat: SEK 4,000.00');
      expect(lines[net + 3]).toBe('configurator.panel.indicative');
    });

    // As the prototype's "Ytbehandling": the group is specified by its
    // "Inget valt", on screen and in the copy alike.
    it('writes an optional single choice left at nothing chosen as "none"', async () => {
      const writeText = grantClipboard();
      const configuration = makeValidConfiguration();
      const top = findOptionGroup(configuration, 'top');
      top.minSelections = undefined;
      for (const option of top.options) option.selected = false;

      const wrapper = mountPanel({ configuration });
      const row = wrapper
        .findAll('[data-testid="configurator-panel-rows"] dl > div')
        .find((candidate) => candidate.find('dt').text() === 'Table top');
      expect(row?.find('dd').text()).toBe('configurator.none_option');

      await copyText(wrapper);
      const copied = writeText.mock.calls[0]?.[0] as string;
      expect(copied).toContain('  Table top:\n    configurator.none_option\n');
    });
  });

  describe('expired', () => {
    it('offers a way to start over instead of an error', () => {
      const wrapper = mountPanel({ status: 'expired' });
      const expired = wrapper.find(
        '[data-testid="configurator-panel-expired"]',
      );
      expect(expired.text()).toContain('configurator.panel.expired');
      expect(expired.text()).toContain('configurator.panel.start_over');
    });

    it('drops the specification and the price', () => {
      const wrapper = mountPanel({ status: 'expired' });
      for (const region of ['header', 'rows', 'price', 'busy']) {
        expect(
          wrapper.find(`[data-testid="configurator-panel-${region}"]`).exists(),
        ).toBe(false);
      }
    });

    it('renders the expired state with no document left', () => {
      // A session that expired before its first response has none.
      const wrapper = mountPanel({ configuration: null, status: 'expired' });
      expect(wrapper.text()).toContain('configurator.panel.expired');
    });

    it('says the cart line is unchanged when the session of an edit expired', () => {
      const wrapper = mountPanel({ status: 'expired', editing: true });
      const expired = wrapper.find(
        '[data-testid="configurator-panel-expired"]',
      );
      expect(expired.text()).toContain('configurator.edit.expired');
      expect(expired.text()).not.toContain('configurator.panel.expired');
      expect(expired.text()).toContain('configurator.panel.start_over');
    });

    it('emits restart when start over is pressed', async () => {
      const wrapper = mountPanel({ status: 'expired' });
      await wrapper
        .find('[data-testid="configurator-panel-expired"]')
        .find('button')
        .trigger('click');
      expect(wrapper.emitted('restart')).toHaveLength(1);
    });
  });
});
