import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Configuration,
  ConfigurationChange,
} from '#shared/types/configurator';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import {
  createFixtureConfiguratorBackend,
  fixtureConfiguratorBackend,
  SESSION_MINUTES,
  DEPARTED_RETENTION_HOURS,
} from '../../../../server/services/configurator-fixture';
import {
  ARBETSBORD_PRO_GEINS_ID,
  ARBETSBORD_PRO_ID,
  MONTERINGSSTATION_PRO_GEINS_ID,
  MONTERINGSSTATION_PRO_ID,
  SKAPSEKTION_PRO_GEINS_ID,
  SKAPSEKTION_PRO_ID,
  createSeedDocument,
} from '../../../../server/services/configurator-fixture/seed';
import type { ConfiguratorContext } from '../../../../server/services/configurator';
import {
  createSessionState,
  evaluate,
} from '../../../../server/services/configurator-fixture/evaluate';
import { everySection } from '../../../../server/services/configurator-fixture/document';
import { arbetsbordPro } from '../../../../server/services/configurator-fixture/seed/arbetsbord-pro';
import {
  findOption,
  findOptionGroup,
  findVariable,
} from '../../../fixtures/configurator';

// ---------------------------------------------------------------------------
// The fixture engine.
//
// It stands in for the CPQ service until the SDK can reach it, so what is
// asserted here is the flow the UI has to survive — a session, a batch of
// changes, the whole re-evaluated document back — and not the provider's
// arithmetic. The prices are the mock's own and describe no contract.
//
// `createAppError` and `ErrorCode` are server auto-imports and resolve to
// globals, stubbed here with the real implementations so the status codes come
// from the real table.
// ---------------------------------------------------------------------------

vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);

const CTX: ConfiguratorContext = { hostname: 'tenant.example.com' };
const OTHER_TENANT: ConfiguratorContext = { hostname: 'other.example.com' };

const MINUTE = 60_000;
const START = Date.parse('2026-01-01T09:00:00.000Z');

let clock = START;
let backend: ReturnType<typeof createFixtureConfiguratorBackend>;

beforeEach(() => {
  clock = START;
  backend = createFixtureConfiguratorBackend({ now: () => clock });
});

function advance(minutes: number) {
  clock += minutes * MINUTE;
}

/** The status an operation failed with, or undefined when it succeeded. */
async function statusOf(call: () => Promise<unknown>) {
  try {
    await call();
    return undefined;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
}

async function start(
  productId = ARBETSBORD_PRO_GEINS_ID,
  quantity = 1,
): Promise<Configuration> {
  return backend.create({ productId, quantity }, CTX);
}

type OptionChange = Extract<ConfigurationChange, { type: 'option' }>;

function selectOption(id: string, instanceId = '0'): OptionChange {
  return {
    type: 'option',
    optionId: id,
    instanceId,
    selected: true,
    quantity: 1,
    lock: 'none',
  };
}

function deselectOption(id: string, instanceId = '0'): OptionChange {
  return { ...selectOption(id, instanceId), selected: false };
}

function setVariable(
  variableId: string,
  value: number | string,
): ConfigurationChange {
  return { type: 'variable', variableId, value };
}

async function withElectricLegs(): Promise<Configuration> {
  const config = await start();
  return backend.applyChanges(
    config.configurationId,
    [selectOption('legs-electric')],
    CTX,
  );
}

// ---------------------------------------------------------------------------
// Starting a session
// ---------------------------------------------------------------------------

describe('create', () => {
  it('returns the seeded document and echoes the requested quantity', async () => {
    const config = await start(ARBETSBORD_PRO_GEINS_ID, 3);

    expect(config.productId).toBe(ARBETSBORD_PRO_ID);
    expect(config.quantity).toBe(3);
    expect(config.templateId).toBe('TPL-KONF-1001');
    expect(config.unitPrice).toEqual({ net: 3200, currency: 'SEK' });
    // A required option group is empty in the seed, so a fresh document is
    // never valid — through the requirement itself, with nothing written under
    // a group the buyer has not reached yet.
    expect(config.isValid).toBe(false);
    expect(findOptionGroup(config, 'color').messages).toEqual([]);
  });

  it('gives the session the configured lifetime', async () => {
    const config = await start();

    expect(Date.parse(config.expiresAt)).toBe(clock + SESSION_MINUTES * MINUTE);
  });

  it('carries the seeded defaults and the product weight', async () => {
    const config = await start();
    const legs = findOption(config, 'legs-fixed');

    expect(config.weightPerUnit).toBe(38.5);
    expect(legs.selected).toBe(true);
    expect(legs.selectionSource).toBe('initial');
    const colour = findOptionGroup(config, 'color');
    expect(colour.minSelections).toBe(1);
    expect(colour.options.some((option) => option.selected)).toBe(false);
    expect(colour.messages).toEqual([]);
  });

  it('answers 404 for a product that is not seeded', async () => {
    expect(await statusOf(() => start('999999'))).toBe(404);
  });

  // The portal identifies a product by its Geins product id everywhere, and
  // translating that to the provider's part id is the backend's job. Asked for
  // by the catalogue product, the document comes back carrying the part id.
  it('resolves the second seed by its Geins product id too', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);

    expect(config.productId).toBe(SKAPSEKTION_PRO_ID);
  });

  it("answers 404 for the provider's part id, which is not a catalogue product", async () => {
    expect(await statusOf(() => start(ARBETSBORD_PRO_ID))).toBe(404);
  });

  it('hands out a separate session per call', async () => {
    const first = await start();
    const second = await start();

    expect(first.configurationId).not.toBe(second.configurationId);

    await backend.applyChanges(
      first.configurationId,
      [selectOption('legs-electric')],
      CTX,
    );

    const untouched = await backend.get(second.configurationId, CTX);
    expect(findOption(untouched, 'legs-electric').selected).toBe(false);
  });

  it('keeps a session inside the tenant that started it', async () => {
    const config = await start();

    expect(
      await statusOf(() => backend.get(config.configurationId, OTHER_TENANT)),
    ).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// The cascades
//
// One test per rule, then the two `legs` rules in a single response, because
// the whole re-evaluated document is what arrives on every change.
// ---------------------------------------------------------------------------

describe('the cascades of the seeded workbench', () => {
  it('selects the power strip by a group rule when the legs go electric', async () => {
    const power = findOption(await withElectricLegs(), 'acc-power');

    expect(power.selected).toBe(true);
    expect(power.selectionSource).toBe('groupRule');
    expect(power.messages).toContainEqual(
      expect.objectContaining({ severity: 'warning' }),
    );
  });

  it('makes the castors unavailable when the legs go electric', async () => {
    const castors = findOption(await withElectricLegs(), 'acc-castors');

    expect(castors.available).toBe(false);
    expect(castors.messages).toContainEqual(
      expect.objectContaining({ severity: 'warning' }),
    );
  });

  it('narrows the width when the top goes steel', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [selectOption('top-steel')],
      CTX,
    );

    const width = findVariable(changed, 'width');
    expect(width.max).toBe(1600);
    // The bound moved; a value already inside it is left alone.
    expect(width.value).toBe(1200);
    expect(width.messages).toEqual([]);
  });

  it('carries both leg outcomes in the same response', async () => {
    const config = await withElectricLegs();

    expect(findOption(config, 'legs-electric').selected).toBe(true);
    expect(findOption(config, 'acc-power').selected).toBe(true);
    expect(findOption(config, 'acc-castors').available).toBe(false);
  });

  it('leaves nothing behind when the trigger is taken away', async () => {
    const started = await withElectricLegs();
    const back = await backend.applyChanges(
      started.configurationId,
      [selectOption('legs-fixed')],
      CTX,
    );

    const power = findOption(back, 'acc-power');
    const castors = findOption(back, 'acc-castors');

    expect(power.selected).toBe(false);
    expect(power.selectionSource).toBe('none');
    expect(power.messages).toEqual([]);
    expect(castors.available).toBe(true);
    expect(castors.messages).toEqual([]);
  });

  it('clamps a width above the narrowed maximum, with a warning', async () => {
    const config = await start();
    const wide = await backend.applyChanges(
      config.configurationId,
      [setVariable('width', 1800)],
      CTX,
    );
    expect(findVariable(wide, 'width').value).toBe(1800);

    const clamped = await backend.applyChanges(
      config.configurationId,
      [selectOption('top-steel')],
      CTX,
    );
    const width = findVariable(clamped, 'width');

    expect(width.value).toBe(1600);
    expect(width.valueSource).toBe('fallback');
    expect(width.messages).toContainEqual(
      expect.objectContaining({ severity: 'warning' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Applying a batch
// ---------------------------------------------------------------------------

describe('what makes a document invalid', () => {
  // The three paths are separate on purpose: a requirement nobody has answered
  // yet, a required variable left empty, and a rule that actually objects.
  function evaluateWith(
    mutate: (config: Configuration) => void,
  ): Configuration {
    return evaluate(
      { ...arbetsbordPro, cascades: [...arbetsbordPro.cascades, mutate] },
      createSessionState(1),
      { configurationId: 'test', expiresAt: '2030-01-01T00:00:00.000Z' },
    );
  }

  it('blocks on an unmet requirement and writes no message for it', () => {
    const config = evaluateWith(() => {});

    expect(config.isValid).toBe(false);
    expect(findOptionGroup(config, 'color').messages).toEqual([]);
  });

  it('blocks on an error a rule put on a group, with every requirement met', () => {
    const config = evaluateWith((document) => {
      const colour = findOption(document, 'ral-9005');
      colour.selected = true;
      findOptionGroup(document, 'color').messages = [
        { severity: 'error', text: 'That finish is out of production.' },
      ];
    });

    expect(config.isValid).toBe(false);
  });

  it('is valid once the requirement is met and nothing objects', () => {
    const config = evaluateWith((document) => {
      findOption(document, 'ral-9005').selected = true;
    });

    expect(config.isValid).toBe(true);
  });

  it('lets a warning stand without blocking', () => {
    // Every rule the seeds have says its piece as a warning; none of them is a
    // reason to refuse the configuration.
    const config = evaluateWith((document) => {
      findOption(document, 'ral-9005').selected = true;
      findOption(document, 'acc-power').messages = [
        { severity: 'warning', text: 'Electric legs require a power strip.' },
      ];
    });

    expect(config.isValid).toBe(true);
  });

  it('blocks on a required variable left empty, and not on one resting at zero', () => {
    // Every seeded variable starts at 0 and is required: counting a zero as
    // missing would make the whole catalogue invalid on arrival.
    const atZero = evaluateWith((document) => {
      findOption(document, 'ral-9005').selected = true;
    });
    expect(findVariable(atZero, 'shelves').value).toBe(0);
    expect(atZero.isValid).toBe(true);

    const emptied = evaluateWith((document) => {
      findOption(document, 'ral-9005').selected = true;
      findVariable(document, 'width').value = null;
    });
    expect(emptied.isValid).toBe(false);
  });
});

describe('a batch of changes', () => {
  it('applies a selection and a deselection in one response', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [selectOption('ral-9005'), deselectOption('top-laminate')],
      CTX,
    );

    expect(findOption(changed, 'ral-9005').selected).toBe(true);
    expect(findOptionGroup(changed, 'color').messages).toEqual([]);
    expect(findOption(changed, 'top-laminate').selected).toBe(false);
    // The emptied group blocks the document without saying anything about it.
    expect(findOptionGroup(changed, 'top').messages).toEqual([]);
    expect(changed.isValid).toBe(false);
  });

  it('returns a deselected row to the source it was created with', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [deselectOption('top-laminate')],
      CTX,
    );

    // A deselection never reports as manual; measured on a live install.
    expect(findOption(changed, 'top-laminate').selectionSource).toBe('initial');
  });

  it('deselects the siblings of a single-select group', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [selectOption('top-steel')],
      CTX,
    );

    expect(findOption(changed, 'top-steel').selectionSource).toBe('manual');
    expect(findOption(changed, 'top-laminate').selected).toBe(false);
    expect(findOption(changed, 'top-laminate').selectionSource).toBe('initial');
  });

  it('carries the new document quantity', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [{ type: 'quantity', quantity: 5 }],
      CTX,
    );

    expect(changed.quantity).toBe(5);

    const single = await backend.applyChanges(
      config.configurationId,
      [{ type: 'quantity', quantity: 1 }],
      CTX,
    );
    expect(single.quantity).toBe(1);
  });

  it("marks a value the buyer set as the buyer's own", async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [setVariable('width', 1400)],
      CTX,
    );
    const width = findVariable(changed, 'width');

    expect(width.value).toBe(1400);
    expect(width.valueSource).toBe('manual');
  });

  it('takes a value on the bounds and refuses one outside them', async () => {
    const config = await start();

    for (const value of [800, 2000]) {
      const changed = await backend.applyChanges(
        config.configurationId,
        [setVariable('width', value)],
        CTX,
      );
      expect(findVariable(changed, 'width').value).toBe(value);
    }

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [setVariable('width', 400)],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('refuses a quantity the row does not allow', async () => {
    const config = await start();
    const outside = [5, 0];

    for (const quantity of outside) {
      expect(
        await statusOf(() =>
          backend.applyChanges(
            config.configurationId,
            [{ ...selectOption('acc-power'), quantity }],
            CTX,
          ),
        ),
        String(quantity),
      ).toBe(422);
    }
  });

  it('keeps both rows when the group allows several', async () => {
    const config = await start();
    await backend.applyChanges(
      config.configurationId,
      [selectOption('acc-pegboard')],
      CTX,
    );
    const changed = await backend.applyChanges(
      config.configurationId,
      [selectOption('acc-light')],
      CTX,
    );

    expect(findOption(changed, 'acc-pegboard').selected).toBe(true);
    expect(findOption(changed, 'acc-light').selected).toBe(true);
  });

  it('rejects the whole batch when a change names an unknown node', async () => {
    const config = await start();

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [selectOption('ral-9005'), selectOption('no-such-option')],
          CTX,
        ),
      ),
    ).toBe(422);

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [selectOption('ral-9005'), setVariable('no-such-variable', 1)],
          CTX,
        ),
      ),
    ).toBe(422);

    const after = await backend.get(config.configurationId, CTX);
    expect(findOption(after, 'ral-9005').selected).toBe(false);
  });

  it('rejects a change aimed at a locked option', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [deselectOption('mount-wall')],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('rejects a change aimed at a row a rule made unavailable', async () => {
    const config = await withElectricLegs();

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [selectOption('acc-castors')],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('rejects a value outside the bounds the document carries', async () => {
    const config = await start();

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [setVariable('width', 2400)],
          CTX,
        ),
      ),
    ).toBe(422);
    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [setVariable('width', 'wide')],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('rejects a quantity below one', async () => {
    const config = await start();

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [{ type: 'quantity', quantity: 0 }],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('refuses to pin a row rather than dropping the flag', async () => {
    const config = await start();

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [{ ...selectOption('ral-9005'), lock: 'lock' }],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('rejects a change aimed at a formula variable', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);

    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [setVariable('front-area', 2)],
          CTX,
        ),
      ),
    ).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Pricing
//
// The mock's arithmetic — base, option deltas, variable delta from default.
// The real provider prices multiplicatively server-side, so nothing here
// describes the contract.
// ---------------------------------------------------------------------------

describe('the price the mock computes', () => {
  it('adds the selected options and the variable delta to the base', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [selectOption('legs-electric'), setVariable('shelves', 2)],
      CTX,
    );

    const electric = findOption(changed, 'legs-electric').unitPrice.net;
    const power = findOption(changed, 'acc-power').unitPrice.net;

    expect(changed.unitPrice.net).toBe(3200 + electric + power + 2 * 450);
    expect(changed.unitPrice.currency).toBe('SEK');
  });

  it('prices the second product from its own base and rates', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);
    // Base, the locked mounting rail and the glass doors that come with it.
    expect(config.unitPrice.net).toBe(5400 + 450);

    const wider = await backend.applyChanges(
      config.configurationId,
      [setVariable('cab-width', 1000)],
      CTX,
    );
    expect(wider.unitPrice.net).toBe(5400 + 450 + 2 * 200);
  });

  it('counts an option quantity above one', async () => {
    const config = await start();
    const changed = await backend.applyChanges(
      config.configurationId,
      [
        {
          type: 'option',
          optionId: 'acc-power',
          instanceId: '0',
          selected: true,
          quantity: 3,
          lock: 'none',
        },
      ],
      CTX,
    );

    const power = findOption(changed, 'acc-power');
    expect(power.quantity).toBe(3);
    expect(changed.unitPrice.net).toBe(3200 + 3 * power.unitPrice.net);
  });
});

// ---------------------------------------------------------------------------
// The session's lifetime
// ---------------------------------------------------------------------------

describe('the session', () => {
  it('moves the expiry forward on every change', async () => {
    const config = await start();
    advance(5);

    const changed = await backend.applyChanges(
      config.configurationId,
      [selectOption('ral-9005')],
      CTX,
    );

    expect(Date.parse(changed.expiresAt)).toBe(
      clock + SESSION_MINUTES * MINUTE,
    );
  });

  it('answers 410 once it has expired', async () => {
    const config = await start();
    advance(SESSION_MINUTES + 1);

    expect(await statusOf(() => backend.get(config.configurationId, CTX))).toBe(
      410,
    );
    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [selectOption('ral-9005')],
          CTX,
        ),
      ),
    ).toBe(410);
  });

  it('is gone the minute it runs out, not a minute later', async () => {
    const config = await start();
    advance(SESSION_MINUTES);

    expect(await statusOf(() => backend.get(config.configurationId, CTX))).toBe(
      410,
    );
  });

  it('answers 404 for an id it never handed out', async () => {
    const calls: [string, () => Promise<unknown>][] = [
      ['get', () => backend.get('no-such-id', CTX)],
      [
        'applyChanges',
        () =>
          backend.applyChanges('no-such-id', [selectOption('ral-9005')], CTX),
      ],
      ['renew', () => backend.renew('no-such-id', CTX)],
      ['release', () => backend.release('no-such-id', CTX)],
      ['commit', () => backend.commit('no-such-id', CTX)],
    ];

    for (const [name, call] of calls) {
      expect(await statusOf(call), name).toBe(404);
    }
  });
});

describe('renew', () => {
  it('extends a live session and returns the new expiry', async () => {
    const config = await start();
    advance(15);

    const { expiresAt } = await backend.renew(config.configurationId, CTX);

    expect(Date.parse(expiresAt)).toBe(clock + SESSION_MINUTES * MINUTE);
    advance(SESSION_MINUTES - 1);
    await expect(
      backend.get(config.configurationId, CTX),
    ).resolves.toMatchObject({ configurationId: config.configurationId });
  });

  it('answers 410 on an expired session rather than reviving it', async () => {
    const config = await start();
    advance(SESSION_MINUTES + 1);

    expect(
      await statusOf(() => backend.renew(config.configurationId, CTX)),
    ).toBe(410);
  });
});

describe('release', () => {
  it('answers 410 while the departed session is still retained', async () => {
    const config = await start();
    await backend.release(config.configurationId, CTX);

    expect(await statusOf(() => backend.get(config.configurationId, CTX))).toBe(
      410,
    );

    advance(DEPARTED_RETENTION_HOURS * 60 - 1);
    expect(await statusOf(() => backend.get(config.configurationId, CTX))).toBe(
      410,
    );
  });

  it('lets the id fall back to 404 once the retention window passes', async () => {
    const config = await start();
    await backend.release(config.configurationId, CTX);
    advance(DEPARTED_RETENTION_HOURS * 60);

    expect(await statusOf(() => backend.get(config.configurationId, CTX))).toBe(
      404,
    );
  });
});

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

describe('commit', () => {
  async function completed(): Promise<Configuration> {
    const config = await start(ARBETSBORD_PRO_GEINS_ID, 2);
    return backend.applyChanges(
      config.configurationId,
      [
        selectOption('legs-electric'),
        selectOption('ral-9005'),
        setVariable('shelves', 2),
      ],
      CTX,
    );
  }

  it('freezes the price and carries the session forward', async () => {
    const config = await completed();
    expect(config.isValid).toBe(true);

    const committed = await backend.commit(config.configurationId, CTX);

    expect(committed.committedConfigurationId).toBeTruthy();
    expect(committed.configurationId).toBe(config.configurationId);
    expect(committed.productId).toBe(ARBETSBORD_PRO_ID);
    expect(committed.quantity).toBe(2);
    expect(committed.unitPrice).toEqual(config.unitPrice);
  });

  it('summarises every selected option and every changed variable', async () => {
    const committed = await backend.commit(
      (await completed()).configurationId,
      CTX,
    );
    const labels = committed.summary.map((line) => line.label);

    expect(labels).toContain('Electric height legs');
    expect(labels).toContain('Power strip');
    expect(labels).toContain('Black (RAL 9005)');
    expect(labels).toContain('Shelves');
    // Untouched variables are not part of what was configured.
    expect(labels).not.toContain('Depth');

    // An untouched row is not part of what was configured either.
    expect(labels).not.toContain('LED light bar');

    const shelves = committed.summary.find((line) => line.label === 'Shelves');
    expect(shelves?.value).toBe('2 pcs');
    expect(shelves?.price).toEqual({ net: 2 * 450, currency: 'SEK' });

    const power = committed.summary.find(
      (line) => line.label === 'Power strip',
    );
    expect(power?.value).toBe('1');
    expect(power?.price).toEqual({ net: 550, currency: 'SEK' });
  });

  it('keeps the frozen record readable after the session is gone', async () => {
    const config = await completed();
    const committed = await backend.commit(config.configurationId, CTX);

    expect(
      backend.readCommitted(committed.committedConfigurationId, CTX),
    ).toEqual(committed);
    // Another storefront never sees it.
    expect(
      backend.readCommitted(committed.committedConfigurationId, OTHER_TENANT),
    ).toBeUndefined();
  });

  it('leaves a variable the provider computes without a price', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);
    const committed = await backend.commit(config.configurationId, CTX);
    const area = committed.summary.find((line) => line.label === 'Front area');

    expect(area?.value).toBe('1.6 m²');
    expect(area?.price).toBeUndefined();
  });

  it('prices a summary row by quantity and by distance from the default', async () => {
    const config = await start();
    const ready = await backend.applyChanges(
      config.configurationId,
      [
        { ...selectOption('acc-pegboard'), quantity: 2 },
        selectOption('ral-9005'),
        setVariable('width', 1400),
      ],
      CTX,
    );
    expect(ready.isValid).toBe(true);

    const committed = await backend.commit(config.configurationId, CTX);
    const pegboard = committed.summary.find(
      (line) => line.label === 'Tool pegboard',
    );
    const width = committed.summary.find((line) => line.label === 'Width');

    expect(pegboard?.value).toBe('2');
    expect(pegboard?.price).toEqual({ net: 2 * 900, currency: 'SEK' });
    expect(width?.value).toBe('1400 mm');
    expect(width?.price).toEqual({ net: 1.5 * 200, currency: 'SEK' });
  });

  it('departs the session, so the id answers 410 afterwards', async () => {
    const config = await completed();
    await backend.commit(config.configurationId, CTX);

    expect(await statusOf(() => backend.get(config.configurationId, CTX))).toBe(
      410,
    );
    expect(
      await statusOf(() => backend.commit(config.configurationId, CTX)),
    ).toBe(410);
  });

  it('refuses a configuration that is not valid', async () => {
    const config = await start();

    expect(
      await statusOf(() => backend.commit(config.configurationId, CTX)),
    ).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// The second seed
//
// It exists so the UI has data for the states the workbench never reaches.
// ---------------------------------------------------------------------------

describe('the second seeded product', () => {
  it('has a section the UI must not show', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);
    const hidden = config.sections.filter((section) => !section.visible);

    expect(hidden).toHaveLength(1);
    expect(hidden[0]!.variables.length).toBeGreaterThan(0);
  });

  it('has an option no change can touch', async () => {
    const mount = findOption(
      await start(SKAPSEKTION_PRO_GEINS_ID),
      'mount-wall',
    );

    expect(mount.selected).toBe(true);
    expect(mount.selectionSource).toBe('locked');
  });

  it('has a string variable the buyer may set', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);
    const changed = await backend.applyChanges(
      config.configurationId,
      [setVariable('pallet-code', 'PAL-120')],
      CTX,
    );

    expect(findVariable(changed, 'pallet-code').value).toBe('PAL-120');
    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [setVariable('pallet-code', 120)],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('computes the formula variable from the others', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);
    const area = findVariable(config, 'front-area');

    expect(area.valueSource).toBe('formula');
    expect(area.selectionSource).toBe('locked');
    expect(area.value).toBe(1.6);

    const changed = await backend.applyChanges(
      config.configurationId,
      [setVariable('cab-width', 1000)],
      CTX,
    );

    expect(findVariable(changed, 'front-area').value).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// The third seed
//
// It exists for the two shapes no other seeded document has: a tree three
// levels deep, and a hidden section holding a section that says it is visible.
// A layout that pages a configuration by section is judged on those, and until
// this seed they could only be built by hand in a test.
// ---------------------------------------------------------------------------

describe('the third seeded product', () => {
  /** Every section of the document, parents before children. */
  const flatten = (
    sections: Configuration['sections'],
    depth = 0,
  ): { id: string; depth: number; visible: boolean }[] =>
    sections.flatMap((section) => [
      { id: section.id, depth, visible: section.visible },
      ...flatten(section.sections, depth + 1),
    ]);

  it('nests three levels deep', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const sections = flatten(config.sections);

    // Named, not counted: a tree that lost its middle level would still reach
    // depth 2 through some other branch and a maximum would not notice.
    expect(sections.find((s) => s.id === 'structure')?.depth).toBe(0);
    expect(sections.find((s) => s.id === 'worktop')?.depth).toBe(1);
    expect(sections.find((s) => s.id === 'edge')?.depth).toBe(2);
  });

  it('has four visible sections at the top and one that is hidden', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);

    expect(config.sections.filter((s) => s.visible).map((s) => s.id)).toEqual([
      'structure',
      'storage',
      'power',
      'accessories',
    ]);
    expect(config.sections.filter((s) => !s.visible).map((s) => s.id)).toEqual([
      'logistics',
    ]);
  });

  it('hides a section whose child says it is visible', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const logistics = config.sections.find((s) => s.id === 'logistics');
    const packaging = logistics?.sections[0];

    // The document states the contradiction; resolving it is the consumer's
    // job, and every consumer resolves it by not descending into a hidden
    // parent at all. Without this pair the rule has nothing to run against.
    expect(logistics?.visible).toBe(false);
    expect(packaging?.id).toBe('packaging');
    expect(packaging?.visible).toBe(true);
  });

  it('gives every visible section something to show', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const visible = flatten(config.sections).filter((s) => s.visible);
    const showsOf = (id: string) => {
      const found = everySection(config.sections).find((s) => s.id === id)!;
      return (
        found.optionGroups.length +
        found.variables.length +
        found.sections.filter((child) => child.visible).length
      );
    };

    // Choices of its own, or the children it is a way in to. A section with
    // neither would be a heading over an empty column, and that is the one
    // shape this document must not carry.
    expect(visible.length).toBeGreaterThan(0);
    for (const section of visible) {
      expect(showsOf(section.id)).toBeGreaterThan(0);
    }
  });

  it('carries a section that is a way in rather than a page', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const accessories = config.sections.find((s) => s.id === 'accessories')!;

    // Two visible children and nothing of its own: the page shows the menu and
    // none of the section's own content, which no other seed could exercise.
    expect(accessories.optionGroups).toEqual([]);
    expect(accessories.variables).toEqual([]);
    expect(
      accessories.sections.filter((child) => child.visible).map((c) => c.id),
    ).toEqual(['tool-holding', 'waste']);
  });

  it('carries a middle level with one child and nothing of its own', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const tools = everySection(config.sections).find(
      (s) => s.id === 'tool-holding',
    )!;

    // One child is no choice to make, so the page renders the section and
    // offers the way on below it rather than as a menu.
    expect(tools.optionGroups).toEqual([]);
    expect(tools.variables).toEqual([]);
    expect(tools.sections.map((child) => child.id)).toEqual(['tool-rails']);
  });

  it('is valid on arrival', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);

    // A page that cannot be committed from the start is a page nobody can
    // judge. The hidden branch counts too: `validate` weighs the whole tree.
    expect(config.isValid).toBe(true);
    expect(
      everySection(config.sections)
        .flatMap((s) => s.optionGroups)
        .some((group) => group.options.some((option) => option.selected)),
    ).toBe(true);
  });

  it('computes the packed volume inside the hidden branch', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const volume = findVariable(config, 'crate-volume');

    // (2400+120) × (900+120) × 400 mm³ = 1028.2 l
    expect(volume.valueSource).toBe('formula');
    expect(volume.value).toBe(1028.2);
  });

  it('adds the third leg pair once the station is long enough', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    expect(findOption(config, 'legs-third').selected).toBe(false);

    const changed = await backend.applyChanges(
      config.configurationId,
      [setVariable('length', 3200)],
      CTX,
    );
    const third = findOption(changed, 'legs-third');

    expect(third.selected).toBe(true);
    expect(third.selectionSource).toBe('groupRule');
  });

  it('adds it at the length the rule names, not one step past it', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const changed = await backend.applyChanges(
      config.configurationId,
      [setVariable('length', 3000)],
      CTX,
    );

    // The boundary itself: "3000 mm or more" is what the message says, and a
    // rule that fired one step late would say something else.
    expect(findOption(changed, 'legs-third').selected).toBe(true);
  });

  it('narrows the edge trim two levels down from the worktop', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const chosen = await backend.applyChanges(
      config.configurationId,
      [selectOption('edge-beech')],
      CTX,
    );
    expect(findOption(chosen, 'edge-beech').selected).toBe(true);

    const steel = await backend.applyChanges(
      config.configurationId,
      [selectOption('top-steel')],
      CTX,
    );

    // The rule reaches from a group in the second level into a group in the
    // third, which is the direction only a nested document has.
    expect(findOption(steel, 'edge-beech').available).toBe(false);
    expect(findOption(steel, 'edge-beech').selected).toBe(false);
    expect(findOption(steel, 'edge-abs').selected).toBe(true);
    // The group it emptied is required, so the document must not have gone
    // invalid on a change the buyer made somewhere else.
    expect(steel.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The exported instance
// ---------------------------------------------------------------------------

describe('the default instance', () => {
  it('runs on the real clock', async () => {
    const config = await fixtureConfiguratorBackend.create(
      { productId: ARBETSBORD_PRO_GEINS_ID, quantity: 1 },
      CTX,
    );

    expect(Date.parse(config.expiresAt)).toBeGreaterThan(Date.now());
    await fixtureConfiguratorBackend.release(config.configurationId, CTX);
  });
});

// ---------------------------------------------------------------------------
// The seed a caller outside a session builds on
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The catalogue products the seeds stand for
// ---------------------------------------------------------------------------

describe("the seeds' catalogue reference", () => {
  // These two ids are the only part of the fixture that points at something
  // outside it — the products on the team tenant, created for this. Getting one
  // wrong makes the page render an ordinary product with no way to tell why, and
  // nothing else in the suite would notice: every other test asks by the
  // constant, so it would follow the constant into being wrong.
  it.each([
    ['Arbetsbord Pro', ARBETSBORD_PRO_GEINS_ID, '1101'],
    ['Skåpsektion Pro', SKAPSEKTION_PRO_GEINS_ID, '1102'],
    ['Monteringsstation Pro', MONTERINGSSTATION_PRO_GEINS_ID, '1103'],
  ])('has %s standing for catalogue product %s', (_label, declared, id) => {
    expect(declared).toBe(id);
  });

  it('keeps the provider part ids distinct from the catalogue ids', () => {
    expect(ARBETSBORD_PRO_ID).not.toBe(ARBETSBORD_PRO_GEINS_ID);
    expect(SKAPSEKTION_PRO_ID).not.toBe(SKAPSEKTION_PRO_GEINS_ID);
    expect(MONTERINGSSTATION_PRO_ID).not.toBe(MONTERINGSSTATION_PRO_GEINS_ID);
  });
});

describe('createSeedDocument', () => {
  it('builds the document from the Geins product id, as create does', () => {
    const document = createSeedDocument(ARBETSBORD_PRO_GEINS_ID, {
      configurationId: 'c1',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });

    expect(document.productId).toBe(ARBETSBORD_PRO_ID);
  });

  it('refuses a product it has no seed for', () => {
    expect(() =>
      createSeedDocument('999999', {
        configurationId: 'c1',
        expiresAt: '2030-01-01T00:00:00.000Z',
      }),
    ).toThrow(/No seeded product/);
  });
});
