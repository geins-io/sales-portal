/**
 * Component Testing Utilities
 *
 * Helpers for testing Vue components with @vue/test-utils
 */

import { mount, shallowMount, type MountingOptions } from '@vue/test-utils';
import type { Component } from 'vue';

/**
 * Default mounting options for component tests
 */
export const defaultMountOptions: MountingOptions<unknown> = {
  global: {
    stubs: {
      // Stub common components
      NuxtLink: {
        template: '<a><slot /></a>',
        props: ['to'],
      },
      NuxtImg: {
        template: '<img :src="src" :alt="alt" />',
        props: ['src', 'alt'],
      },
      Icon: {
        template: '<span class="icon" :data-name="name"></span>',
        props: ['name'],
      },
      ClientOnly: {
        template: '<slot />',
      },
    },
    mocks: {
      // Mock i18n — return the key as-is for test assertions
      $t: (key: string) => key,
      // Mock common Nuxt composables
      $router: {
        push: () => Promise.resolve(),
        replace: () => Promise.resolve(),
        go: () => {},
        back: () => {},
        forward: () => {},
      },
      $route: {
        path: '/',
        params: {},
        query: {},
        hash: '',
        fullPath: '/',
        name: 'index',
      },
    },
  },
};

/**
 * Mount a component with default options
 */
export function mountComponent<T extends Component>(
  component: T,
  options: MountingOptions<unknown> = {},
) {
  return mount(component, {
    ...defaultMountOptions,
    ...options,
    global: {
      ...defaultMountOptions.global,
      ...options.global,
      stubs: {
        ...defaultMountOptions.global?.stubs,
        ...options.global?.stubs,
      },
      mocks: {
        ...defaultMountOptions.global?.mocks,
        ...options.global?.mocks,
      },
    },
  });
}

/**
 * Shallow mount a component with default options
 */
export function shallowMountComponent<T extends Component>(
  component: T,
  options: MountingOptions<unknown> = {},
) {
  return shallowMount(component, {
    ...defaultMountOptions,
    ...options,
    global: {
      ...defaultMountOptions.global,
      ...options.global,
      stubs: {
        ...defaultMountOptions.global?.stubs,
        ...options.global?.stubs,
      },
      mocks: {
        ...defaultMountOptions.global?.mocks,
        ...options.global?.mocks,
      },
    },
  });
}

/**
 * Create a test component with a slot
 */
export function renderWithSlot(
  component: Component,
  slotContent: string,
  options: MountingOptions<unknown> = {},
) {
  return mountComponent(component, {
    ...options,
    slots: {
      default: slotContent,
      ...options.slots,
    },
  });
}

/**
 * Assert that a component emits a specific event
 */
export function expectEmitted(
  wrapper: ReturnType<typeof mount>,
  eventName: string,
  times = 1,
) {
  const emitted = wrapper.emitted(eventName);
  expect(emitted).toBeTruthy();
  expect(emitted?.length).toBe(times);
}

/**
 * Assert that a component does not emit a specific event
 */
export function expectNotEmitted(
  wrapper: ReturnType<typeof mount>,
  eventName: string,
) {
  const emitted = wrapper.emitted(eventName);
  expect(emitted).toBeFalsy();
}

/**
 * Get emitted event payload
 */
export function getEmittedPayload<T>(
  wrapper: ReturnType<typeof mount>,
  eventName: string,
  index = 0,
): T | undefined {
  const emitted = wrapper.emitted(eventName);
  return emitted?.[index]?.[0] as T | undefined;
}

/**
 * Simulate a keyboard event
 */
export async function triggerKeyboard(
  wrapper: ReturnType<typeof mount>,
  selector: string,
  key: string,
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  } = {},
) {
  const element = wrapper.find(selector);
  await element.trigger('keydown', {
    key,
    ctrlKey: modifiers.ctrl,
    shiftKey: modifiers.shift,
    altKey: modifiers.alt,
    metaKey: modifiers.meta,
  });
}

/**
 * Wait for Vue to update the DOM
 */
export async function waitForDom(wrapper: ReturnType<typeof mount>) {
  await wrapper.vm.$nextTick();
}

/**
 * Create a mock provide/inject context
 */
export function createProvideContext(
  provides: Record<string | symbol, unknown>,
) {
  return {
    global: {
      provide: provides,
    },
  };
}
