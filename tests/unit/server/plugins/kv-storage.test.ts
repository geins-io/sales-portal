import { describe, it, expect, vi } from 'vitest';

// The module's default export is a Nitro plugin, so importing it needs the
// auto-imports the node tier does not run. resolveKvMount itself touches
// neither, which is why the decision lives outside the plugin body.
vi.stubGlobal('defineNitroPlugin', (fn: () => void) => fn);
vi.stubGlobal('useStorage', () => ({ mount: vi.fn() }));

const { resolveKvMount } =
  await import('../../../../server/plugins/00.kv-storage');

describe('resolveKvMount', () => {
  it('defaults to memory when nothing is set', () => {
    expect(resolveKvMount({})).toEqual({ driver: 'memory' });
  });

  it('mounts redis on the configured url', () => {
    expect(
      resolveKvMount({
        NUXT_STORAGE_DRIVER: 'redis',
        NUXT_STORAGE_REDIS_URL: 'redis://cache:6379',
      }),
    ).toEqual({ driver: 'redis', url: 'redis://cache:6379' });
  });

  it('refuses redis with no url rather than falling back to memory', () => {
    // A silent fallback is indistinguishable from a working deployment right
    // up until a restart discards every tenant the app wrote.
    expect(() => resolveKvMount({ NUXT_STORAGE_DRIVER: 'redis' })).toThrow(
      /NUXT_STORAGE_REDIS_URL is not set/,
    );
  });

  it('refuses a driver it cannot mount', () => {
    // `fs` was documented for a while and never produced a mount, so it has
    // to fail loudly rather than be read as memory.
    expect(() => resolveKvMount({ NUXT_STORAGE_DRIVER: 'fs' })).toThrow(
      /Unknown NUXT_STORAGE_DRIVER: "fs"/,
    );
  });

  it('treats an empty driver value as unset', () => {
    expect(resolveKvMount({ NUXT_STORAGE_DRIVER: '' })).toEqual({
      driver: 'memory',
    });
  });
});
