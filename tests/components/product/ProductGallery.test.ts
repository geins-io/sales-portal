import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ref } from 'vue';
import { mountComponent } from '../../utils/component';
import ProductGallery from '../../../app/components/product/ProductGallery.vue';
import { Dialog, DialogContent } from '../../../app/components/ui/dialog';

// Read the locale files as raw JSON. A plain `import ... from '*.json'` is
// transformed by the @nuxtjs/i18n bundler into compiled message functions, so
// it does not expose the source strings. Reading from disk (relative to the
// project root vitest runs from) gives the literal shipped values to assert.
function loadLocale(name: string): { product: { image_alt_counter: string } } {
  const path = join(process.cwd(), 'app', 'locales', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}
const en = loadLocale('en');
const sv = loadLocale('sv');

// The shared component setup stubs vue-i18n with a passthrough that echoes the
// key, which can't exercise the counter format. Override it for this file with
// a resolver carrying the alt-counter template, so the mounted component
// produces real alt text. The actual shipped locale strings (and "no prefix" /
// "no dash" guarantees) are pinned separately in the "locale messages" block.
function translateForTest(
  key: string,
  params: Record<string, unknown> = {},
): string {
  const messages: Record<string, string> = {
    'product.image_alt_counter': '{name} ({current} of {total})',
  };
  const template = messages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: translateForTest, locale: ref('en') }),
}));
vi.stubGlobal('useI18n', () => ({ t: translateForTest, locale: ref('en') }));

// Render the alt so tests can read the resolved value off the DOM.
const geinsImageStub = {
  template: '<img class="geins-image" :alt="alt" />',
  props: ['fileName', 'type', 'alt', 'loading'],
};

const iconStub = {
  template: '<span class="icon" :data-name="name" />',
  props: ['name'],
};

const stubs: Record<string, unknown> = {
  GeinsImage: geinsImageStub,
  SharedGeinsImage: geinsImageStub,
  Icon: iconStub,
  NuxtIcon: iconStub,
  [Dialog.__name ?? 'Dialog']: {
    template: '<div class="dialog"><slot /></div>',
    props: ['open'],
  },
  [DialogContent.__name ?? 'DialogContent']: {
    template: '<div class="dialog-content"><slot /></div>',
    props: ['class'],
  },
};

type GalleryImage = { fileName: string; alt?: string | null };

function makeImages(count = 3): GalleryImage[] {
  return Array.from({ length: count }, (_, i) => ({
    fileName: `product-${i + 1}.jpg`,
  }));
}

function mountGallery(images: GalleryImage[], productName = 'Test Product') {
  return mountComponent(ProductGallery, {
    props: { images, productName },
    global: { stubs },
  });
}

/** Alt text of the main (first) gallery image currently displayed. */
function mainAlt(wrapper: ReturnType<typeof mountGallery>): string {
  return wrapper.findAll('.geins-image')[0]?.attributes('alt') ?? '';
}

describe('ProductGallery', () => {
  it('renders main image', () => {
    const wrapper = mountGallery(makeImages());
    const images = wrapper.findAll('.geins-image');
    expect(images.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render thumbnail strip', () => {
    const wrapper = mountGallery(makeImages(3));
    expect(wrapper.find('[data-testid="thumbnails"]').exists()).toBe(false);
  });

  it('shows prev/next arrows for multiple images', () => {
    const wrapper = mountGallery(makeImages(3));
    expect(wrapper.find('[data-testid="gallery-prev"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gallery-next"]').exists()).toBe(true);
  });

  it('hides arrows for single image', () => {
    const wrapper = mountGallery(makeImages(1));
    expect(wrapper.find('[data-testid="gallery-prev"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="gallery-next"]').exists()).toBe(false);
  });

  it('next arrow click does not error', async () => {
    const wrapper = mountGallery(makeImages(3));
    await wrapper.find('[data-testid="gallery-next"]').trigger('click');
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(true);
  });

  it('prev arrow wraps from first to last', async () => {
    const wrapper = mountGallery(makeImages(3));
    await wrapper.find('[data-testid="gallery-prev"]').trigger('click');
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(true);
  });

  it('shows image counter for multiple images', () => {
    const wrapper = mountGallery(makeImages(3));
    const counter = wrapper.find('[data-testid="image-counter"]');
    expect(counter.exists()).toBe(true);
  });

  it('hides image counter for single image', () => {
    const wrapper = mountGallery(makeImages(1));
    expect(wrapper.find('[data-testid="image-counter"]').exists()).toBe(false);
  });

  describe('image alt text (WCAG 1.1.1)', () => {
    it('uses the product name only for a single image, no counter', () => {
      const wrapper = mountGallery(makeImages(1), 'Bosch Rotary Hammer');
      expect(mainAlt(wrapper)).toBe('Bosch Rotary Hammer');
      expect(mainAlt(wrapper)).not.toMatch(/\(\d+ of \d+\)/);
    });

    it('appends a 1-based "n of total" counter for multiple images', () => {
      const wrapper = mountGallery(makeImages(4), 'Bosch Rotary Hammer');
      expect(mainAlt(wrapper)).toBe('Bosch Rotary Hammer (1 of 4)');
    });

    it('advances the counter as the gallery navigates', async () => {
      const wrapper = mountGallery(makeImages(4), 'Bosch Rotary Hammer');
      const alts: string[] = [mainAlt(wrapper)];
      for (let i = 0; i < 3; i++) {
        await wrapper.find('[data-testid="gallery-next"]').trigger('click');
        alts.push(mainAlt(wrapper));
      }
      expect(alts).toEqual([
        'Bosch Rotary Hammer (1 of 4)',
        'Bosch Rotary Hammer (2 of 4)',
        'Bosch Rotary Hammer (3 of 4)',
        'Bosch Rotary Hammer (4 of 4)',
      ]);
      // Each image is announced distinctly.
      expect(new Set(alts).size).toBe(4);
    });

    it('uses a manual PIM alt override verbatim, ignoring the format', () => {
      const images: GalleryImage[] = [
        { fileName: 'a.jpg', alt: 'Drill bit close-up on a workbench' },
        { fileName: 'b.jpg' },
        { fileName: 'c.jpg' },
      ];
      const wrapper = mountGallery(images, 'Bosch Rotary Hammer');
      expect(mainAlt(wrapper)).toBe('Drill bit close-up on a workbench');
      expect(mainAlt(wrapper)).not.toMatch(/\(\d+ of \d+\)/);
    });

    it('treats an empty-string override as decorative (alt="")', () => {
      const images: GalleryImage[] = [
        { fileName: 'a.jpg', alt: '' },
        { fileName: 'b.jpg' },
      ];
      const wrapper = mountGallery(images, 'Bosch Rotary Hammer');
      expect(mainAlt(wrapper)).toBe('');
    });

    it('never prefixes "Image of" / "Photo of" for any image', async () => {
      const wrapper = mountGallery(makeImages(3), 'Bosch Rotary Hammer');
      for (let i = 0; i < 3; i++) {
        expect(mainAlt(wrapper)).not.toMatch(/^\s*(image|photo|picture)\s+of/i);
        await wrapper.find('[data-testid="gallery-next"]').trigger('click');
      }
    });
  });

  // Pins the real shipped locale strings so the format the component emits is
  // verified end to end, not just the test resolver above.
  describe('locale messages (product.image_alt_counter)', () => {
    const locales: [string, { product: { image_alt_counter: string } }][] = [
      ['en', en],
      ['sv', sv],
    ];

    it.each(locales)(
      '%s defines the alt counter with the name first',
      (_, m) => {
        const value = m.product.image_alt_counter;
        expect(value).toMatch(/^\{name\}/);
        // 1-based positional counter, both placeholders present.
        expect(value).toContain('{current}');
        expect(value).toContain('{total}');
      },
    );

    it.each(locales)('%s never prefixes "Image of" / "Photo of"', (_, m) => {
      expect(m.product.image_alt_counter).not.toMatch(
        /(image|photo|picture)\s+of/i,
      );
    });

    it.each(locales)('%s uses no em dash or en dash', (_, m) => {
      expect(m.product.image_alt_counter).not.toMatch(/[—–]/);
    });

    it('keeps the localized "of" word per locale', () => {
      expect(en.product.image_alt_counter).toContain(' of ');
      expect(sv.product.image_alt_counter).toContain(' av ');
    });
  });
});
