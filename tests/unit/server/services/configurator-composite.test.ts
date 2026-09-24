import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Configuration } from '#shared/types/configurator';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
} from '../../../../server/services/configurator';
import { createCompositeConfiguratorBackend } from '../../../../server/services/configurator-composite';
import {
  createFixtureConfiguratorBackend,
  SESSION_MINUTES,
} from '../../../../server/services/configurator-fixture';
import {
  ARBETSBORD_PRO_GEINS_ID,
  ARBETSBORD_PRO_ID,
} from '../../../../server/services/configurator-fixture/seed';

// ---------------------------------------------------------------------------
// The composite backend: the fixture for its seeds, the real backend for every
// other product. A create names a product; every later call names only an id,
// so those are routed by which backend owns the id.
// ---------------------------------------------------------------------------

vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);

const CTX: ConfiguratorContext = { hostname: 'tenant.example.com' };
const REAL_ID = 'real-configuration-1';
const MINUTE = 60_000;

const REAL_DOCUMENT = {
  configurationId: REAL_ID,
  articleNumber: '001-2',
} as Configuration;

let clock = Date.parse('2026-01-01T09:00:00.000Z');
let fixture: ReturnType<typeof createFixtureConfiguratorBackend>;
let real: { [K in keyof ConfiguratorBackend]: ReturnType<typeof vi.fn> };
let composite: ConfiguratorBackend;

beforeEach(() => {
  clock = Date.parse('2026-01-01T09:00:00.000Z');
  fixture = createFixtureConfiguratorBackend({ now: () => clock });
  real = {
    isConfigurable: vi.fn(() => false),
    create: vi.fn(async () => REAL_DOCUMENT),
    get: vi.fn(async () => REAL_DOCUMENT),
    applyChanges: vi.fn(async () => REAL_DOCUMENT),
    renew: vi.fn(async () => ({ expiresAt: 'later' })),
    release: vi.fn(async () => undefined),
    commit: vi.fn(async () => ({})),
  };
  composite = createCompositeConfiguratorBackend(
    fixture,
    real as unknown as ConfiguratorBackend,
  );
});

async function statusOf(call: () => Promise<unknown>) {
  try {
    await call();
    return undefined;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
}

describe('isConfigurable', () => {
  it('says yes for a product a seed stands for, without asking the real backend', () => {
    expect(
      composite.isConfigurable(
        { productId: ARBETSBORD_PRO_GEINS_ID, type: 'product' },
        CTX,
      ),
    ).toBe(true);
    expect(real.isConfigurable).not.toHaveBeenCalled();
  });

  it('asks the real backend for every other product', () => {
    real.isConfigurable.mockReturnValue(true);
    const product = { productId: '1359', type: 'configurable' };

    expect(composite.isConfigurable(product, CTX)).toBe(true);
    expect(real.isConfigurable).toHaveBeenCalledWith(product, CTX);
  });

  it('says no when neither backend configures the product', () => {
    expect(
      composite.isConfigurable({ productId: '1359', type: 'product' }, CTX),
    ).toBe(false);
  });
});

describe('create', () => {
  it('starts a seed product on the fixture', async () => {
    const config = await composite.create(
      { productId: ARBETSBORD_PRO_GEINS_ID, quantity: 1 },
      CTX,
    );

    expect(config.articleNumber).toBe(ARBETSBORD_PRO_ID);
    expect(real.create).not.toHaveBeenCalled();
  });

  it('starts every other product on the real backend', async () => {
    const input = { productId: '1359', quantity: 2 };

    expect(await composite.create(input, CTX)).toBe(REAL_DOCUMENT);
    expect(real.create).toHaveBeenCalledWith(input, CTX);
  });
});

describe('the calls that carry only an id', () => {
  async function fixtureSession() {
    return composite.create(
      { productId: ARBETSBORD_PRO_GEINS_ID, quantity: 1 },
      CTX,
    );
  }

  it('sends a fixture id to the fixture on every verb', async () => {
    const { configurationId: id } = await fixtureSession();

    await composite.get(id, CTX);
    await composite.applyChanges(id, [{ type: 'quantity', quantity: 2 }], CTX);
    await composite.renew(id, CTX);
    await composite.release(id, CTX);

    for (const verb of ['get', 'applyChanges', 'renew', 'release'] as const) {
      expect(real[verb], verb).not.toHaveBeenCalled();
    }
  });

  it('sends a fixture id to the fixture on commit', async () => {
    const { configurationId: id } = await fixtureSession();

    // The untouched seed is not valid yet: the fixture's own 422 proves the
    // call went there.
    expect(await statusOf(() => composite.commit(id, CTX))).toBe(422);
    expect(real.commit).not.toHaveBeenCalled();
  });

  it('keeps an expired fixture id on the fixture, which answers 410', async () => {
    const { configurationId: id } = await fixtureSession();
    clock += (SESSION_MINUTES + 1) * MINUTE;

    expect(await statusOf(() => composite.get(id, CTX))).toBe(410);
    expect(real.get).not.toHaveBeenCalled();
  });

  it('sends every other id to the real backend', async () => {
    const changes = [{ type: 'quantity' as const, quantity: 2 }];

    await composite.get(REAL_ID, CTX);
    await composite.applyChanges(REAL_ID, changes, CTX);
    await composite.renew(REAL_ID, CTX);
    await composite.release(REAL_ID, CTX);
    await composite.commit(REAL_ID, CTX);

    expect(real.get).toHaveBeenCalledWith(REAL_ID, CTX);
    expect(real.applyChanges).toHaveBeenCalledWith(REAL_ID, changes, CTX);
    expect(real.renew).toHaveBeenCalledWith(REAL_ID, CTX);
    expect(real.release).toHaveBeenCalledWith(REAL_ID, CTX);
    expect(real.commit).toHaveBeenCalledWith(REAL_ID, CTX);
  });

  it('sends a fixture id started on another tenant to the real backend', async () => {
    const { configurationId: id } = await fixtureSession();
    const other: ConfiguratorContext = { hostname: 'other.example.com' };

    await composite.get(id, other);
    expect(real.get).toHaveBeenCalledWith(id, other);
  });
});
