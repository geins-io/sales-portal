/**
 * The resolver's cache mount, run on the real unstorage drivers Nitro mounts:
 * the resolver's driver resolved by name as Nitro does, and the memory driver
 * for the root and for Nitro's default `cache` mount, where the tenant config
 * and the category tree live.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  builtinDrivers,
  createStorage,
  type Driver,
  type Storage,
} from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import {
  RESOLVE_URL_CACHE_BASE,
  RESOLVE_URL_CACHE_MAX_ENTRIES,
  resolveUrlCacheMount,
} from '../../server/utils/resolve-url-cache';

// The storage key Nitro's defineCachedEventHandler writes an entry under
// (nitropack runtime/internal/cache.mjs: [base, group, name, key].join(':')).
const handlerKey = (base: string, key: string) =>
  `${base}:nitro/handlers:_:${key}.json`;
const resolverKey = (i: number) =>
  handlerKey(RESOLVE_URL_CACHE_BASE, `hostsesvlpath${i}`);
const configKey = handlerKey('/cache', '74656e616e743a636f6e666967');
const rootKey = 'other:entry';

// What Nitro does with a `nitro.storage` entry: look the driver up by name.
const driverFor = async (mount: { driver?: string }): Promise<Driver> => {
  const path = builtinDrivers[mount.driver as keyof typeof builtinDrivers];
  const { default: driver } = (await import(path)) as {
    default: (opts: unknown) => Driver;
  };
  return driver(mount);
};

const fillResolver = async (storage: Storage, from: number, to: number) => {
  for (let i = from; i < to; i++) {
    await storage.setItem(resolverKey(i), { value: { body: `{"i":${i}}` } });
  }
};

describe('resolve-url cache mount', () => {
  let storage: Storage;

  beforeEach(async () => {
    storage = createStorage();
    storage.mount('cache', memoryDriver());
    storage.mount(
      RESOLVE_URL_CACHE_BASE,
      await driverFor(resolveUrlCacheMount),
    );
  });

  it('evicts the oldest entry once the cap is reached', async () => {
    await fillResolver(storage, 0, RESOLVE_URL_CACHE_MAX_ENTRIES + 1);

    expect(await storage.getItem(resolverKey(0))).toBeNull();
    expect(
      await storage.getItem(resolverKey(RESOLVE_URL_CACHE_MAX_ENTRIES)),
    ).not.toBeNull();
    expect(await storage.getKeys(RESOLVE_URL_CACHE_BASE)).toHaveLength(
      RESOLVE_URL_CACHE_MAX_ENTRIES,
    );
  });

  it('keeps an entry that was read and evicts the least recently used one', async () => {
    await fillResolver(storage, 0, RESOLVE_URL_CACHE_MAX_ENTRIES);
    await storage.getItem(resolverKey(0));
    await fillResolver(
      storage,
      RESOLVE_URL_CACHE_MAX_ENTRIES,
      RESOLVE_URL_CACHE_MAX_ENTRIES + 1,
    );

    expect(await storage.getItem(resolverKey(0))).not.toBeNull();
    expect(await storage.getItem(resolverKey(1))).toBeNull();
  });

  it('leaves entries on the root and the default cache mount alone when the resolver fills up', async () => {
    await storage.setItem(configKey, { value: { body: '{}' } });
    await storage.setItem(rootKey, 'kept');
    await fillResolver(storage, 0, RESOLVE_URL_CACHE_MAX_ENTRIES * 2);

    expect(await storage.getItem(configKey)).not.toBeNull();
    expect(await storage.getKeys('cache')).toHaveLength(1);
    expect(await storage.getItem(rootKey)).toBe('kept');
  });
});

describe('nuxt.config.ts mounts the resolver cache', () => {
  it('puts resolveUrlCacheMount on the resolver base under nitro.storage', async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config);
    const { default: nuxtConfig } =
      (await import('../../nuxt.config')) as unknown as {
        default: { nitro: { storage: Record<string, unknown> } };
      };

    expect(nuxtConfig.nitro.storage[RESOLVE_URL_CACHE_BASE]).toBe(
      resolveUrlCacheMount,
    );
  });
});
