import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Button, buttonVariants } from '../../app/components/ui/button';

describe('Button Component', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      const wrapper = mount(Button, {
        slots: {
          default: 'Click me',
        },
      });

      expect(wrapper.text()).toBe('Click me');
      expect(wrapper.attributes('data-slot')).toBe('button');
    });

    it('should render as a button element by default', () => {
      const wrapper = mount(Button);

      expect(wrapper.element.tagName).toBe('BUTTON');
    });

    it('should render slot content', () => {
      const wrapper = mount(Button, {
        slots: {
          default: '<span class="icon">★</span> Save',
        },
      });

      expect(wrapper.find('.icon').exists()).toBe(true);
      expect(wrapper.text()).toContain('Save');
    });
  });

  describe('variants', () => {
    it('should apply default variant classes', () => {
      const wrapper = mount(Button);
      const classes = wrapper.classes().join(' ');

      expect(classes).toContain('bg-primary');
    });

    it('should apply destructive variant classes', () => {
      const wrapper = mount(Button, {
        props: {
          variant: 'destructive',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('bg-destructive');
    });

    it('should apply outline variant classes', () => {
      const wrapper = mount(Button, {
        props: {
          variant: 'outline',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('border');
    });

    it('should apply secondary variant classes', () => {
      const wrapper = mount(Button, {
        props: {
          variant: 'secondary',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('bg-secondary');
    });

    it('should apply ghost variant classes', () => {
      const wrapper = mount(Button, {
        props: {
          variant: 'ghost',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('hover:bg-accent');
    });

    it('should apply link variant classes', () => {
      const wrapper = mount(Button, {
        props: {
          variant: 'link',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('underline-offset-4');
    });
  });

  describe('sizes', () => {
    it('should apply default size classes', () => {
      const wrapper = mount(Button);
      const classes = wrapper.classes().join(' ');

      expect(classes).toContain('h-9');
    });

    it('should apply small size classes', () => {
      const wrapper = mount(Button, {
        props: {
          size: 'sm',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('h-8');
    });

    it('should apply large size classes', () => {
      const wrapper = mount(Button, {
        props: {
          size: 'lg',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('h-10');
    });

    it('should apply icon size classes', () => {
      const wrapper = mount(Button, {
        props: {
          size: 'icon',
        },
      });

      const classes = wrapper.classes().join(' ');
      expect(classes).toContain('size-9');
    });
  });

  describe('custom class', () => {
    it('should merge custom classes with variant classes', () => {
      const wrapper = mount(Button, {
        props: {
          class: 'custom-class',
        },
      });

      expect(wrapper.classes()).toContain('custom-class');
    });
  });

  describe('events', () => {
    it('should emit click event when clicked', async () => {
      const wrapper = mount(Button);

      await wrapper.trigger('click');

      expect(wrapper.emitted('click')).toBeTruthy();
    });
  });

  describe('as prop', () => {
    it('should render as different element when as prop is provided', () => {
      const wrapper = mount(Button, {
        props: {
          as: 'a',
        },
      });

      expect(wrapper.element.tagName).toBe('A');
    });
  });
});

describe('buttonVariants', () => {
  it('should return default variant classes', () => {
    const classes = buttonVariants();
    expect(classes).toContain('bg-primary');
  });

  it('should return correct classes for each variant', () => {
    const variants = [
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'link',
    ] as const;

    variants.forEach((variant) => {
      const classes = buttonVariants({ variant });
      expect(classes).toBeDefined();
      expect(typeof classes).toBe('string');
    });
  });

  it('should return correct classes for each size', () => {
    const sizes = ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'] as const;

    sizes.forEach((size) => {
      const classes = buttonVariants({ size });
      expect(classes).toBeDefined();
      expect(typeof classes).toBe('string');
    });
  });

  it('should combine variant and size classes', () => {
    const classes = buttonVariants({ variant: 'destructive', size: 'lg' });
    expect(classes).toContain('bg-destructive');
    expect(classes).toContain('h-10');
  });
});
