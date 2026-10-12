import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadBackendValue = vi.fn();

vi.mock('../../../server/services/configurator-config', () => ({
  readConfiguratorBackendValue: (...args: unknown[]) =>
    mockReadBackendValue(...args),
}));

// Nitro runs every plugin once at startup; running it on definition is the same.
vi.stubGlobal('defineNitroPlugin', (fn: () => void) => fn());

async function startWith(value: unknown) {
  mockReadBackendValue.mockReturnValue(value);
  vi.resetModules();
  await import('../../../server/plugins/06.configurator-backend');
}

describe('configurator backend check at startup', () => {
  beforeEach(() => {
    mockReadBackendValue.mockReset();
  });

  it.each([
    ['nothing set', undefined],
    ['an empty value', ''],
    ['fixture', 'fixture'],
    ['merchant-api', 'merchant-api'],
  ])('starts with %s', async (_label, value) => {
    await expect(startWith(value)).resolves.toBeUndefined();
    expect(mockReadBackendValue).toHaveBeenCalledOnce();
  });

  it.each(['off', 'sdk', 'composite', 'bogus'])(
    'refuses to start with %s',
    async (value) => {
      await expect(startWith(value)).rejects.toThrow(
        `Unknown CONFIGURATOR_BACKEND "${value}"`,
      );
    },
  );
});
