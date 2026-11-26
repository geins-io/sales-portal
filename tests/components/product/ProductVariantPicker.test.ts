import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  assert,
  vi,
} from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import type { SkuType } from '@geins/types';
import { mountComponent } from '../../utils/component';
import ProductVariantPicker from '../../../app/components/product/ProductVariantPicker.vue';
import VariantSelector from '../../../app/components/product/VariantSelector.vue';
import VariantListPanel from '../../../app/components/product/VariantListPanel.vue';
import VariantListDropdown from '../../../app/components/product/VariantListDropdown.vue';
import VariantDimensionSelects from '../../../app/components/product/VariantDimensionSelects.vue';
import { useTenant } from '../../../app/composables/useTenant';
import type { PublicTenantConfig } from '#shared/types/tenant-config';
import { variantCombinations } from '../../../app/utils/variant-tree';
import { twoDimensionTree } from '../../fixtures/variant-trees';
import { mockShowIncVat } from '../../setup-components';

type VariantSelectorSetting = NonNullable<
  NonNullable<PublicTenantConfig['layout']>['variantSelector']
>;

// Each child is replaced by a stand-in with the same name that renders its
// props as data and exposes the method the picker calls on it.
const opened = vi.fn();
function standIn(name: string, method: 'open' | 'openSkuSheet') {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: [
      'kind',
      'rows',
      'disabled',
      'combinations',
      'modelValue',
      'skuOptions',
      'skuId',
      'variants',
      'variantDimensions',
    ],
    emits: ['select', 'update:modelValue', 'update:skuId'],
    setup(props, { expose }) {
      expose({ [method]: () => opened(name, props.kind) });
      return () => h('div', { 'data-stand-in': name, 'data-kind': props.kind });
    },
  });
}
const stubs = {
  VariantSelector: standIn('VariantSelector', 'openSkuSheet'),
  VariantListPanel: standIn('VariantListPanel', 'open'),
  VariantListDropdown: standIn('VariantListDropdown', 'open'),
  VariantDimensionSelects: standIn('VariantDimensionSelects', 'open'),
};

const combinations = variantCombinations(twoDimensionTree);
const currentM12 = { Gänga: 'm12', Längd: '60 mm' };
const skus: SkuType[] = [
  { skuId: 11, name: 'Rulle 50 m', articleNumber: 'K-50' },
  { skuId: 12, name: 'Rulle 100 m', articleNumber: 'K-100' },
];

let saved: PublicTenantConfig['layout'];

function setSetting(
  variantSelector: VariantSelectorSetting | null | undefined,
) {
  const { tenant } = useTenant();
  assert.isDefined(tenant.value);
  tenant.value = {
    ...tenant.value,
    layout: variantSelector === undefined ? undefined : { variantSelector },
  };
}

beforeEach(() => {
  saved = useTenant().tenant.value?.layout;
  mockShowIncVat.value = true;
  opened.mockClear();
});

afterEach(() => {
  const { tenant } = useTenant();
  assert.isDefined(tenant.value);
  tenant.value = { ...tenant.value, layout: saved };
});

type Shape = 'siblings' | 'skus' | 'both';

function mountPicker(shape: Shape, extra: Record<string, unknown> = {}) {
  const withSiblings = shape !== 'skus';
  const withSkus = shape !== 'siblings';
  return mountComponent(ProductVariantPicker, {
    props: {
      variantDimensions: [],
      variants: withSiblings ? twoDimensionTree : [],
      combinations: withSiblings ? combinations : [],
      modelValue: withSiblings ? currentM12 : {},
      skuOptions: withSkus ? skus : [],
      skuId: null,
      skus: withSkus ? skus : [],
      productName: 'Sexkantskruv',
      productArticleNumber: 'PARENT-1',
      priceIncVatFormatted: '125 kr',
      priceExVatFormatted: '100 kr',
      variantProducts: {},
      ...extra,
    },
    global: { stubs },
  });
}

/** What renders, in order: "Component:kind". */
function rendered(wrapper: ReturnType<typeof mountPicker>) {
  return wrapper
    .findAll('[data-stand-in]')
    .map((el) =>
      [el.attributes('data-stand-in'), el.attributes('data-kind')]
        .filter(Boolean)
        .join(':'),
    );
}

describe('ProductVariantPicker', () => {
  describe('what each setting renders', () => {
    const cases: [
      VariantSelectorSetting | null | undefined,
      Record<Shape, string[]>,
    ][] = [
      [
        undefined,
        {
          siblings: ['VariantSelector'],
          skus: ['VariantSelector'],
          both: ['VariantSelector'],
        },
      ],
      [
        null,
        {
          siblings: ['VariantSelector'],
          skus: ['VariantSelector'],
          both: ['VariantSelector'],
        },
      ],
      [
        { display: 'panel', grouping: 'dimension' },
        {
          siblings: ['VariantSelector'],
          skus: ['VariantSelector'],
          both: ['VariantSelector'],
        },
      ],
      [
        { display: 'panel', grouping: 'none' },
        {
          siblings: ['VariantListPanel:variant'],
          skus: ['VariantListPanel:sku'],
          both: ['VariantListPanel:variant', 'VariantListPanel:sku'],
        },
      ],
      [
        { display: 'dropdown', grouping: 'none' },
        {
          siblings: ['VariantListDropdown:variant'],
          skus: ['VariantListDropdown:sku'],
          both: ['VariantListDropdown:variant', 'VariantListDropdown:sku'],
        },
      ],
      [
        { display: 'dropdown', grouping: 'dimension' },
        {
          siblings: ['VariantDimensionSelects'],
          skus: ['VariantListDropdown:sku'],
          both: ['VariantDimensionSelects', 'VariantListDropdown:sku'],
        },
      ],
    ];

    for (const [setting, expected] of cases) {
      for (const shape of ['siblings', 'skus', 'both'] as const) {
        it(`${JSON.stringify(setting)} with ${shape}: ${expected[shape].join(' + ')}`, () => {
          setSetting(setting);
          expect(rendered(mountPicker(shape))).toEqual(expected[shape]);
        });
      }
    }
  });

  it("renders today's panel when the store has no variantSelector", () => {
    setSetting(undefined);
    expect(rendered(mountPicker('siblings'))).toEqual(['VariantSelector']);
  });

  it('renders one list in a panel for variantSelector display panel and grouping none', () => {
    setSetting({ display: 'panel', grouping: 'none' });
    expect(rendered(mountPicker('siblings'))).toEqual([
      'VariantListPanel:variant',
    ]);
  });

  it('renders one select per dimension for variantSelector display dropdown and grouping dimension', () => {
    setSetting({ display: 'dropdown', grouping: 'dimension' });
    expect(rendered(mountPicker('siblings'))).toEqual([
      'VariantDimensionSelects',
    ]);
  });

  it('groups by dimension for variantSelector display dropdown without a grouping', () => {
    setSetting({ display: 'dropdown' });
    expect(rendered(mountPicker('siblings'))).toEqual([
      'VariantDimensionSelects',
    ]);
  });

  it('opens a panel for a variantSelector grouping none without a display', () => {
    setSetting({ grouping: 'none' });
    expect(rendered(mountPicker('siblings'))).toEqual([
      'VariantListPanel:variant',
    ]);
  });

  it("renders today's panel when the variants come without a tree, whatever the setting", () => {
    setSetting({ display: 'dropdown', grouping: 'none' });
    const wrapper = mountPicker('siblings', {
      combinations: [],
      variantDimensions: [
        { dimension: 'Color', value: 'Red', label: 'Red', level: 0 },
      ],
    });
    expect(rendered(wrapper)).toEqual(['VariantSelector']);
  });

  describe('a product that is its only variant, sold in several SKUs, shows only the SKU choice', () => {
    // As Geins sends it: one variant node, the product itself, under the
    // internal dimension.
    const ownNode = {
      dimension: 'DefaultProduct',
      value: 'Skyddsglasögon klar',
      label: 'Skyddsglasögon klar',
      level: 1,
      alias: 'skyddsglasogon-klar',
      productId: 1099,
    };
    const only = variantCombinations([ownNode]);
    const cases: [VariantSelectorSetting | undefined, string[]][] = [
      [undefined, ['VariantSelector']],
      [{ display: 'panel', grouping: 'none' }, ['VariantListPanel:sku']],
      [{ display: 'dropdown', grouping: 'none' }, ['VariantListDropdown:sku']],
      [
        { display: 'dropdown', grouping: 'dimension' },
        ['VariantListDropdown:sku'],
      ],
    ];
    for (const [setting, expected] of cases) {
      it(`${JSON.stringify(setting)}: ${expected.join(' + ')}`, () => {
        setSetting(setting);
        const wrapper = mountPicker('skus', {
          variants: [ownNode],
          combinations: only,
          modelValue: { ...only[0]!.selection },
        });
        expect(rendered(wrapper)).toEqual(expected);
      });
    }
  });

  it('renders nothing for a product with neither variants nor several SKUs', () => {
    setSetting({ display: 'dropdown', grouping: 'none' });
    const wrapper = mountPicker('siblings', {
      combinations: [],
      variants: [],
      skuOptions: [],
    });
    expect(rendered(wrapper)).toEqual([]);
  });

  it('hands the lists one row per variant and per SKU', () => {
    setSetting({ display: 'panel', grouping: 'none' });
    const wrapper = mountPicker('both', { skuId: 12 });
    const [variantList, skuList] = wrapper.findAllComponents(VariantListPanel);
    expect(
      (
        variantList!.props('rows') as { label: string; selected: boolean }[]
      ).map((r) => [r.label, r.selected]),
    ).toEqual([
      ['M10, 50 mm', false],
      ['M12, 60 mm', true],
      ['M8, 40 mm', false],
    ]);
    expect(
      (skuList!.props('rows') as { key: string; selected: boolean }[]).map(
        (r) => [r.key, r.selected],
      ),
    ).toEqual([
      ['11', false],
      ['12', true],
    ]);
  });

  it('turns a picked variant row into its whole selection, and a SKU row into its id', async () => {
    setSetting({ display: 'dropdown', grouping: 'none' });
    const wrapper = mountPicker('both');
    const [variantList, skuList] =
      wrapper.findAllComponents(VariantListDropdown);
    variantList!.vm.$emit('select', combinations[0]!.alias);
    skuList!.vm.$emit('select', '11');
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ Gänga: 'm10', Längd: '50 mm' }],
    ]);
    expect(wrapper.emitted('update:skuId')).toEqual([[11]]);
  });

  it('passes the dimension selects their v-model', () => {
    setSetting({ display: 'dropdown', grouping: 'dimension' });
    const wrapper = mountPicker('siblings');
    const selects = wrapper.findComponent(VariantDimensionSelects);
    expect(selects.props('modelValue')).toEqual(currentM12);
    selects.vm.$emit('update:modelValue', { Gänga: 'm8', Längd: '40 mm' });
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ Gänga: 'm8', Längd: '40 mm' }],
    ]);
  });

  it('disables the new controls while the page changes', () => {
    setSetting({ display: 'dropdown', grouping: 'none' });
    const wrapper = mountPicker('both', { disabled: true });
    expect(
      wrapper
        .findAllComponents(VariantListDropdown)
        .map((c) => c.props('disabled')),
    ).toEqual([true, true]);
  });

  describe('openSkuSheet() opens the SKU control in every setting', () => {
    const cases: [VariantSelectorSetting | undefined, string][] = [
      [undefined, 'VariantSelector'],
      [{ display: 'panel', grouping: 'none' }, 'VariantListPanel'],
      [{ display: 'dropdown', grouping: 'none' }, 'VariantListDropdown'],
      [{ display: 'dropdown', grouping: 'dimension' }, 'VariantListDropdown'],
    ];
    for (const [setting, control] of cases) {
      it(`${JSON.stringify(setting)}: ${control}`, async () => {
        setSetting(setting);
        const wrapper = mountPicker('both');
        (wrapper.vm as unknown as { openSkuSheet: () => void }).openSkuSheet();
        await nextTick();
        expect(opened).toHaveBeenCalledTimes(1);
        expect(opened.mock.calls[0]![0]).toBe(control);
        if (control !== 'VariantSelector') {
          expect(opened.mock.calls[0]![1]).toBe('sku');
        }
      });
    }
  });

  it('passes the v-models through the panel grouped by dimension', () => {
    setSetting(undefined);
    const wrapper = mountPicker('both', { skuId: 12 });
    const panel = wrapper.findComponent(VariantSelector);
    expect(panel.props('combinations')).toEqual(combinations);
    expect(panel.props('modelValue')).toEqual(currentM12);
    expect(panel.props('skuOptions')).toEqual(skus);
    expect(panel.props('skuId')).toBe(12);
    panel.vm.$emit('update:modelValue', { Gänga: 'm8', Längd: '40 mm' });
    panel.vm.$emit('update:skuId', 11);
    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ Gänga: 'm8', Längd: '40 mm' }],
    ]);
    expect(wrapper.emitted('update:skuId')).toEqual([[11]]);
  });
});
