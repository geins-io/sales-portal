import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { enableAutoUnmount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { mountComponent } from '../../utils/component';
import { useProductTabPrint } from '../../../app/composables/useProductTabPrint';

// The listener is what makes `data-testid="product-tabs"` mean something: both
// product tab rows carry the attribute, and printing expands the panels behind
// it. Driven here through real print events on a row that looks like theirs.
const Host = defineComponent({
  setup() {
    useProductTabPrint();
  },
  template: `
    <div data-testid="product-tabs">
      <div data-print="description" hidden data-testid="description" />
      <div data-print="specifications" hidden data-testid="specifications" />
      <div data-print="documents" hidden data-testid="documents" />
      <div data-print="related" data-testid="related" />
    </div>
  `,
});

function hidden(testid: string): boolean {
  return !!document
    .querySelector(`[data-testid="${testid}"]`)
    ?.hasAttribute('hidden');
}

// Every mount here registers a window listener, so a wrapper left mounted keeps
// unhiding panels in later tests.
enableAutoUnmount(afterEach);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('useProductTabPrint', () => {
  it('unhides the panels worth printing, and only those', () => {
    mountComponent(Host, { attachTo: document.body });

    window.dispatchEvent(new Event('beforeprint'));

    expect(hidden('description')).toBe(false);
    expect(hidden('specifications')).toBe(false);
    expect(hidden('documents')).toBe(true);
  });

  it('puts the panels back afterwards, so the screen is unchanged', () => {
    mountComponent(Host, { attachTo: document.body });

    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));

    expect(hidden('description')).toBe(true);
    expect(hidden('specifications')).toBe(true);
  });

  it('leaves a panel that was already open alone on afterprint', () => {
    mountComponent(Host, { attachTo: document.body });

    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));

    expect(hidden('related')).toBe(false);
  });

  it('stops listening once the row is gone', () => {
    const wrapper = mountComponent(Host, { attachTo: document.body });
    const row = document.querySelector('[data-testid="product-tabs"]')!;
    document.body.append(row.cloneNode(true));
    wrapper.unmount();

    window.dispatchEvent(new Event('beforeprint'));

    expect(hidden('description')).toBe(true);
  });
});
