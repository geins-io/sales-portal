import { describe, it, expect, vi } from 'vitest';
import type { H3Event } from 'h3';
import type {
  Configuration,
  ConfigurationChange,
  ConfigurationSection,
  CommittedConfiguration,
} from '#shared/types/configurator';
import {
  createAppError,
  ErrorCode,
  withErrorHandling,
} from '../../../../../server/utils/errors';
import {
  createFixtureConfiguratorBackend,
  SESSION_MINUTES,
  DEPARTED_RETENTION_HOURS,
} from '../../../../../server/services/configurator-fixture';
import {
  ARBETSBORD_PRO_ID,
  SKAPSEKTION_PRO_ID,
} from '../../../../../server/services/configurator-fixture/seed';
import type { ConfiguratorContext } from '../../../../../server/services/configurator';
import {
  findOption,
  findOptionGroup,
  findVariable,
} from '../../../../fixtures/configurator';

// ---------------------------------------------------------------------------
// The CPQ verification walk, against the fixture.
//
// The CPQ service ships this walk as the thing every provider of the contract
// must pass. Running it here is what turns "the fixture behaves like the API"
// into a measured claim: one session driven through the real route handlers
// over a real engine, in the order a buyer would drive it.
//
// What is real: the routes, the gate, the input schemas, `withErrorHandling`,
// the error table and the whole engine. What is replaced: the seam, so the
// engine can be built on a clock this file owns, and the tenant's feature map,
// so the gate opens. `tests/.../harness.ts` is deliberately not imported — it
// mocks the backend away, which is the one thing this suite exists to exercise.
//
// The walk stops at `commit`. The service's own walk ends with
// `cpq/carts/evaluate` on the committed id; the portal has no cart pricing
// route and the fixture has no pricing area, so that step belongs to the cart
// specification rather than here.
//
// There is no HTTP layer: a handler is called as a function, success is a
// resolved promise, and a status is the `statusCode` on the `H3Error` it threw.
// ---------------------------------------------------------------------------

const HOSTNAME = 'tenant.example.com';
const CTX: ConfiguratorContext = { hostname: HOSTNAME };

const MINUTE = 60_000;
const START = Date.parse('2026-01-01T09:00:00.000Z');

let clock = START;
let backend = createFixtureConfiguratorBackend({ now: () => clock });

function advance(minutes: number): void {
  clock += minutes * MINUTE;
}

vi.mock('../../../../../server/services/configurator', () => ({
  getConfiguratorBackend: () => backend,
  buildConfiguratorContext: () => CTX,
}));

vi.mock('../../../../../server/services/tenant-config', () => ({
  getFeatures: async () => ({ configurator: { enabled: true } }),
}));

// ---------------------------------------------------------------------------
// Nitro auto-imports
//
// The same shapes the route harness stubs, on purpose: the node project runs
// `isolate: false`, so these live on a `globalThis` shared with every other
// spec in the worker and two spellings of the same global would be a trap.
// `createAppError` and `withErrorHandling` are the real ones, so the errors
// here are the same `H3Error` class the routes re-throw unchanged.
// ---------------------------------------------------------------------------

interface RouteEvent {
  context: { tenant: { hostname: string; config: { mode: string } } };
  params: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
  authToken?: string;
}

const asRouteEvent = (event: H3Event) => event as unknown as RouteEvent;

vi.stubGlobal('defineEventHandler', (fn: unknown) => fn);
vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);
vi.stubGlobal('withErrorHandling', withErrorHandling);
vi.stubGlobal(
  'createError',
  ({
    statusCode,
    statusMessage,
  }: {
    statusCode: number;
    statusMessage?: string;
  }) =>
    Object.assign(new Error(statusMessage ?? String(statusCode)), {
      statusCode,
    }),
);
vi.stubGlobal('getAuthCookies', (event: H3Event) => ({
  authToken: asRouteEvent(event).authToken,
  refreshToken: undefined,
}));
vi.stubGlobal(
  'setResponseHeader',
  (event: H3Event, name: string, value: string) => {
    asRouteEvent(event).headers[name] = value;
  },
);
vi.stubGlobal(
  'getRouterParam',
  (event: H3Event, name: string) => asRouteEvent(event).params[name],
);
vi.stubGlobal(
  'readValidatedBody',
  async (event: H3Event, validate: (raw: unknown) => unknown) =>
    validate(asRouteEvent(event).body),
);

// ---------------------------------------------------------------------------
// Calling a route
// ---------------------------------------------------------------------------

function makeEvent(init: { id?: string; body?: unknown } = {}): H3Event {
  const event: RouteEvent = {
    context: { tenant: { hostname: HOSTNAME, config: { mode: 'commerce' } } },
    params: init.id === undefined ? {} : { id: init.id },
    headers: {},
    body: init.body,
  };
  return event as unknown as H3Event;
}

type RouteHandler = (event: H3Event) => Promise<unknown>;

// Imported inside the call rather than at the top: a route module runs
// `defineEventHandler` as it loads, and a static import is hoisted above the
// stub that provides it.
async function createConfiguration(
  productId: string,
  quantity = 1,
): Promise<Configuration> {
  const handler: RouteHandler = (
    await import('../../../../../server/api/configurations/index.post')
  ).default;
  return (await handler(
    makeEvent({ body: { productId, quantity } }),
  )) as Configuration;
}

async function postChanges(
  id: string,
  changes: ConfigurationChange[],
): Promise<Configuration> {
  const handler: RouteHandler = (
    await import('../../../../../server/api/configurations/[id]/changes.post')
  ).default;
  return (await handler(makeEvent({ id, body: { changes } }))) as Configuration;
}

async function getConfiguration(id: string): Promise<Configuration> {
  const handler: RouteHandler = (
    await import('../../../../../server/api/configurations/[id].get')
  ).default;
  return (await handler(makeEvent({ id }))) as Configuration;
}

async function commitConfiguration(
  id: string,
): Promise<CommittedConfiguration> {
  const handler: RouteHandler = (
    await import('../../../../../server/api/configurations/[id]/commit.post')
  ).default;
  return (await handler(makeEvent({ id }))) as CommittedConfiguration;
}

async function renewConfiguration(id: string): Promise<{ expiresAt: string }> {
  const handler: RouteHandler = (
    await import('../../../../../server/api/configurations/[id]/renew.post')
  ).default;
  return (await handler(makeEvent({ id }))) as { expiresAt: string };
}

async function deleteConfiguration(id: string): Promise<void> {
  const handler: RouteHandler = (
    await import('../../../../../server/api/configurations/[id].delete')
  ).default;
  await handler(makeEvent({ id }));
}

/** The status a route failed with, or undefined when it answered. */
async function statusOf(call: () => Promise<unknown>) {
  try {
    await call();
    return undefined;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
}

function selectOption(id: string): ConfigurationChange {
  return {
    type: 'option',
    optionId: id,
    instanceId: '0',
    selected: true,
    quantity: 1,
    lock: 'none',
  };
}

function setVariable(
  variableId: string,
  value: number | string,
): ConfigurationChange {
  return { type: 'variable', variableId, value };
}

function everySection(config: Configuration): ConfigurationSection[] {
  const collect = (sections: ConfigurationSection[]): ConfigurationSection[] =>
    sections.flatMap((section) => [section, ...collect(section.sections)]);
  return collect(config.sections);
}

function findSection(config: Configuration, id: string): ConfigurationSection {
  const section = everySection(config).find((candidate) => candidate.id === id);
  if (!section) throw new Error(`No section '${id}' in the configuration`);
  return section;
}

// ---------------------------------------------------------------------------
// The walk
//
// `describe.sequential` because the steps share one session and each reads the
// document the one before it produced. The node project sets
// `sequence.concurrent`, and an ordering this suite depends on should be stated
// rather than inherited.
// ---------------------------------------------------------------------------

describe.sequential('the CPQ verification walk against the fixture', () => {
  /** The session steps 1 to 6 drive, and the last document each step returned. */
  let workbench = '';
  let latest: Configuration;

  it('1. starts a session on the seeded product', async () => {
    clock = START;
    backend = createFixtureConfiguratorBackend({ now: () => clock });

    latest = await createConfiguration(ARBETSBORD_PRO_ID, 2);
    workbench = latest.configurationId;

    expect(latest.productId).toBe(ARBETSBORD_PRO_ID);
    expect(latest.quantity).toBe(2);
    // The colour group arrives empty, and that unmet requirement is what makes
    // a fresh document invalid.
    expect(latest.isValid).toBe(false);
    expect(latest.unitPrice).toEqual({ net: 3200, currency: 'SEK' });
    expect(Date.parse(latest.expiresAt)).toBeGreaterThan(clock);

    const sources = everySection(latest)
      .flatMap((section) => section.optionGroups)
      .flatMap((group) => group.options)
      .map((option) => option.selectionSource);
    expect(sources.length).toBeGreaterThan(0);
    expect([...new Set(sources)].sort()).toEqual(['initial', 'none']);
  });

  it('2. carries both outcomes of the electric legs in one response', async () => {
    latest = await postChanges(workbench, [selectOption('legs-electric')]);

    const power = findOption(latest, 'acc-power');
    expect(power.selected).toBe(true);
    expect(power.selectionSource).toBe('groupRule');
    expect(power.messages).toContainEqual(
      expect.objectContaining({ severity: 'warning' }),
    );

    const castors = findOption(latest, 'acc-castors');
    expect(castors.available).toBe(false);
    expect(castors.messages).toContainEqual(
      expect.objectContaining({ severity: 'warning' }),
    );
  });

  it('3. clamps a width the steel top narrows out from under', async () => {
    // A value above the current bound is refused at change time, so the width
    // has to be set while 2000 still holds; the clamp is what a later change
    // does to a value already there.
    latest = await postChanges(workbench, [setVariable('width', 1800)]);
    expect(findVariable(latest, 'width').value).toBe(1800);
    expect(findVariable(latest, 'width').max).toBe(2000);

    latest = await postChanges(workbench, [selectOption('top-steel')]);

    const width = findVariable(latest, 'width');
    expect(width.max).toBe(1600);
    expect(width.value).toBe(1600);
    expect(width.valueSource).toBe('fallback');
    expect(width.messages).toContainEqual(
      expect.objectContaining({ severity: 'warning' }),
    );
  });

  it('4. reports the second product as computed, locked and hidden', async () => {
    const cabinet = await createConfiguration(SKAPSEKTION_PRO_ID);

    expect(findSection(cabinet, 'logistics').visible).toBe(false);

    const area = findVariable(cabinet, 'front-area');
    expect(area.valueSource).toBe('formula');
    expect(area.selectionSource).toBe('locked');

    const mount = findOptionGroup(cabinet, 'mount');
    expect(
      mount.options.filter((option) => option.selectionSource === 'locked'),
    ).not.toHaveLength(0);
  });

  it('5. commits the completed workbench at a frozen price', async () => {
    latest = await postChanges(workbench, [selectOption('ral-9005')]);
    expect(latest.isValid).toBe(true);

    const committed = await commitConfiguration(workbench);

    expect(committed.committedConfigurationId).toBeTruthy();
    expect(committed.configurationId).toBe(workbench);
    expect(committed.productId).toBe(ARBETSBORD_PRO_ID);
    expect(committed.quantity).toBe(latest.quantity);
    expect(committed.unitPrice).toEqual(latest.unitPrice);
    expect(committed.summary.length).toBeGreaterThan(0);
  });

  it('6. answers 410 on the session it committed', async () => {
    expect(await statusOf(() => getConfiguration(workbench))).toBe(410);
  });

  it('7. answers 410 on a released session until the retention runs out', async () => {
    const released = await createConfiguration(ARBETSBORD_PRO_ID);
    await deleteConfiguration(released.configurationId);

    // 410 rather than 404: the id was this buyer's, and the UI says so.
    expect(
      await statusOf(() => getConfiguration(released.configurationId)),
    ).toBe(410);

    advance(DEPARTED_RETENTION_HOURS * 60);

    expect(
      await statusOf(() => getConfiguration(released.configurationId)),
    ).toBe(404);
  });

  it('8. extends a session on renew and lets it expire after', async () => {
    const renewed = await createConfiguration(ARBETSBORD_PRO_ID);
    const first = Date.parse(renewed.expiresAt);
    // The clock has to move, or the renewed expiry is the one create returned.
    advance(SESSION_MINUTES - 5);

    const { expiresAt } = await renewConfiguration(renewed.configurationId);
    expect(Date.parse(expiresAt)).toBeGreaterThan(first);

    await expect(
      getConfiguration(renewed.configurationId),
    ).resolves.toMatchObject({ configurationId: renewed.configurationId });

    advance(SESSION_MINUTES + 1);

    expect(
      await statusOf(() => getConfiguration(renewed.configurationId)),
    ).toBe(410);
    expect(
      await statusOf(() => renewConfiguration(renewed.configurationId)),
    ).toBe(410);
  });
});
