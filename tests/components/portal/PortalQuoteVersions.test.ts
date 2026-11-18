import { describe, it, expect } from 'vitest';
import { mountComponent } from '../../utils/component';
import PortalQuoteVersions from '../../../app/components/portal/PortalQuoteVersions.vue';
import type { QuoteVersion } from '../../../shared/types/quote';

// The reka-ui primitives stubbed, so the rows and the pick can be read.
const selectStubs = {
  Select: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<div data-testid="select" :data-value="modelValue"><slot /><button data-testid="pick-request" @click="$emit(\'update:modelValue\', \'q-000\')" /></div>',
  },
  SelectTrigger: {
    template: '<button v-bind="$attrs"><slot /></button>',
    props: ['size'],
  },
  SelectValue: { template: '<span data-testid="value"><slot /></span>' },
  SelectContent: { template: '<div><slot /></div>', props: ['align'] },
  SelectItem: {
    props: ['value'],
    template: '<div :data-value="value" v-bind="$attrs"><slot /></div>',
  },
};

// A request and three offers, newest first as Geins sends them.
const chain: QuoteVersion[] = [
  {
    quotationId: 'q-003',
    quotationNumber: '2611-2-1066-03',
    quoteNumber: '2611-2-1066-03',
    status: 'pending',
    validFrom: '2026-11-18T10:03:00Z',
    validTo: '2026-12-31T00:00:00Z',
  },
  {
    quotationId: 'q-002',
    quotationNumber: '2611-2-1066-02',
    quoteNumber: '2611-2-1066-02',
    status: 'revised',
    validFrom: '2026-11-17T10:02:00Z',
    validTo: '2026-12-31T00:00:00Z',
  },
  {
    quotationId: 'q-001',
    quotationNumber: '2611-2-1066-01',
    quoteNumber: '2611-2-1066-01',
    status: 'revised',
    validFrom: '2026-11-16T10:01:00Z',
  },
  {
    quotationId: 'q-000',
    quotationNumber: '2611-2-1066-00',
    quoteNumber: '2611-2-1066-00',
    status: 'revised',
  },
];

function mountPicker(
  currentId = 'q-003',
  versions = chain,
  options: { requestSentAt?: string } = {
    requestSentAt: '2026-11-15T08:55:22Z',
  },
) {
  return mountComponent(PortalQuoteVersions, {
    props: { versions, currentId, requestSentAt: options.requestSentAt },
    global: { stubs: selectStubs },
  });
}

const rows = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.findAll('[data-testid^="quote-version-"]');

describe('PortalQuoteVersions', () => {
  it('lists every version, newest first, by its own id', () => {
    const values = rows(mountPicker()).map((r) => r.attributes('data-value'));

    expect(values).toEqual(['q-003', 'q-002', 'q-001', 'q-000']);
  });

  it('names each offer by its number and the request as the request', () => {
    const texts = rows(mountPicker()).map((r) => r.text());

    expect(texts[0]).toMatch(/^2611-2-1066-03 /);
    expect(texts[2]).toMatch(/^2611-2-1066-01 /);
    expect(texts[3]).toMatch(/^portal\.quotations\.version\.request /);
    expect(texts.join()).not.toContain('2611-2-1066-00');
  });

  it('reads an offer without a number by its status and date alone', () => {
    const unnumbered = chain.map((v) => ({ ...v, quoteNumber: '' }));
    const wrapper = mountPicker('q-002', unnumbered);
    const texts = rows(wrapper).map((r) => r.text());

    expect(texts[1]).toMatch(
      /^portal\.quotations\.status_revised · Nov 17, 2026$/,
    );
    expect(texts[3]).toMatch(/^portal\.quotations\.version\.request /);
    expect(wrapper.find('[data-testid="value"]').text()).toBe(
      'portal.quotations.status_revised',
    );
  });

  it('marks the newest "Senaste" and the others by their status', () => {
    const texts = rows(mountPicker()).map((r) => r.text());

    expect(texts[0]).toContain('portal.quotations.revisions.latest');
    expect(texts[1]).toContain('portal.quotations.status_revised');
    expect(texts[1]).not.toContain('portal.quotations.revisions.latest');
    expect(texts[3]).toContain('portal.quotations.revisions.request_sent');
  });

  it('marks the newest "Senaste" whatever its status', () => {
    const canceled = [
      { ...chain[0]!, status: 'canceled' as const },
      ...chain.slice(1),
    ];
    const texts = rows(mountPicker('q-002', canceled)).map((r) => r.text());

    expect(texts[0]).toContain('portal.quotations.revisions.latest');
    expect(texts[0]).not.toContain('portal.quotations.status_canceled');
  });

  it('dates each offer by when it was sent, the request by when the buyer sent it', () => {
    const texts = rows(mountPicker()).map((r) => r.text());

    expect(texts[0]).toMatch(/18/);
    expect(texts[1]).toMatch(/17/);
    expect(texts[2]).toMatch(/16/);
    expect(texts[3]).toMatch(/15/);
  });

  it('gives the request no date when none is known', () => {
    const text = rows(
      mountPicker('q-003', chain, { requestSentAt: undefined }),
    )[3]!.text();

    expect(text).not.toMatch(/2026/);
  });

  it('says how long only the newest is valid', () => {
    const texts = rows(mountPicker()).map((r) => r.text());

    expect(texts[0]).toContain('portal.quotations.revisions.valid_to');
    expect(texts[1]).not.toContain('portal.quotations.revisions.valid_to');
  });

  it('shows the open version on the trigger', () => {
    const wrapper = mountPicker('q-002');

    expect(
      wrapper.find('[data-testid="select"]').attributes('data-value'),
    ).toBe('q-002');
    const trigger = wrapper.find('[data-testid="quote-revision-select"]');
    expect(trigger.text()).toContain('portal.quotations.revisions.label');
    expect(trigger.text()).toContain(
      '2611-2-1066-02 · portal.quotations.status_revised',
    );
    expect(trigger.attributes('aria-label')).toBe(
      'portal.quotations.revisions.select_label',
    );
  });

  it('names the request on the trigger when it is open', () => {
    const value = mountPicker('q-000').find('[data-testid="value"]');

    expect(value.text()).toBe('portal.quotations.version.request');
  });

  it('hands back the picked version', async () => {
    const wrapper = mountPicker();

    await wrapper.find('[data-testid="pick-request"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([['q-000']]);
  });

  it('hands back nothing when the open version is picked again', async () => {
    const wrapper = mountPicker('q-000');

    await wrapper.find('[data-testid="pick-request"]').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
  });
});
