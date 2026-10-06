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
import {
  everyGroup,
  everyOption,
  everySection,
  everyVariable,
  optionKey,
} from '../../../../server/services/configurator-fixture/document';
import { applyChangeBatch } from '../../../../server/services/configurator-fixture/changes';
import { arbetsbordPro } from '../../../../server/services/configurator-fixture/seed/arbetsbord-pro';
import { monteringsstationPro } from '../../../../server/services/configurator-fixture/seed/monteringsstation-pro';
import { skapsektionPro } from '../../../../server/services/configurator-fixture/seed/skapsektion-pro';
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

    expect(config.articleNumber).toBe(ARBETSBORD_PRO_ID);
    expect(config.quantity).toBe(3);
    expect(config.templateId).toBe('TPL-KONF-1001');
    expect(config.unitPrice).toMatchObject({
      sellingPriceExVat: 3200,
      currency: { code: 'SEK' },
    });
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

    expect(config.articleNumber).toBe(SKAPSEKTION_PRO_ID);
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

  it('does not block on an empty required variable the rules made unavailable', () => {
    const config = evaluateWith((document) => {
      findOption(document, 'ral-9005').selected = true;
      const width = findVariable(document, 'width');
      width.value = null;
      width.available = false;
    });
    expect(config.isValid).toBe(true);
  });

  it('does not block on an unavailable group short of its minimum', () => {
    const config = evaluateWith((document) => {
      findOptionGroup(document, 'color').available = false;
    });
    expect(config.isValid).toBe(true);
  });

  // Availability now decides validity, so the seeds' verdicts stay what they
  // were only while no rule takes a variable or a group away. Every rule runs
  // with every row chosen and with none, each time with the numbers as seeded
  // and at their maximum, which fires each trigger a seed has: the rows' rules
  // read a selection, the long station's reads a length above the seeded one.
  it.each([arbetsbordPro, skapsektionPro, monteringsstationPro])(
    'keeps every variable and group of $productId available, whatever is chosen',
    (seed) => {
      for (const selected of [false, true]) {
        for (const atMax of [false, true]) {
          const state = createSessionState(1);
          const sections = seed.buildSections();
          for (const option of everyOption(sections)) {
            state.options.set(optionKey(option.id, option.instanceId), {
              selected,
              quantity: 1,
            });
          }
          for (const variable of everyVariable(sections)) {
            if (atMax && variable.valueType === 'number' && variable.max) {
              state.variables.set(variable.id, variable.max);
            }
          }
          const config = evaluate(seed, state, {
            configurationId: 'test',
            expiresAt: '2030-01-01T00:00:00.000Z',
          });
          const taken = [
            ...everyVariable(config.sections),
            ...everyGroup(config.sections),
          ].filter((node) => !node.available);
          expect(taken.map((node) => node.id)).toEqual([]);
        }
      }
    },
  );
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

  // A multi-choice row, so no sibling reset is involved: that path puts the
  // seed's default back, which the provider does not.
  it("keeps a row's own quantity through a deselect and a pick that carry none", async () => {
    const config = await start();
    const { quantity: _quantity, ...pick } = selectOption('acc-pegboard');
    await backend.applyChanges(
      config.configurationId,
      [{ ...pick, quantity: 2 }],
      CTX,
    );
    await backend.applyChanges(
      config.configurationId,
      [{ ...pick, selected: false }],
      CTX,
    );
    const changed = await backend.applyChanges(
      config.configurationId,
      [pick],
      CTX,
    );

    expect(findOption(changed, 'acc-pegboard')).toMatchObject({
      selected: true,
      quantity: 2,
    });
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

  it('rejects a change aimed at a read-only option', async () => {
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

  // As the provider: `locked` stops a sibling pick, not the buyer.
  it('takes a deselect and a pick aimed at a locked option', () => {
    const seed = {
      ...arbetsbordPro,
      cascades: [
        ...arbetsbordPro.cascades,
        (document: Configuration) => {
          findOption(document, 'top-laminate').selectionSource = 'locked';
        },
      ],
    };
    const session = {
      configurationId: 'test',
      expiresAt: '2030-01-01T00:00:00.000Z',
    };
    const { quantity: _quantity, ...pick } = selectOption('top-steel');

    const next = applyChangeBatch(seed, createSessionState(1), session, [
      { ...pick, optionId: 'top-laminate', selected: false },
      pick,
    ]);
    const config = evaluate(seed, next, session);

    expect(findOption(config, 'top-laminate').selected).toBe(false);
    expect(findOption(config, 'top-steel').selected).toBe(true);
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

    const electric = findOption(changed, 'legs-electric').unitPrice
      .sellingPriceExVat!;
    const power = findOption(changed, 'acc-power').unitPrice.sellingPriceExVat!;

    expect(changed.unitPrice.sellingPriceExVat).toBe(
      3200 + electric + power + 2 * 450,
    );
    expect(changed.unitPrice.currency?.code).toBe('SEK');
  });

  it('prices the second product from its own base and rates', async () => {
    const config = await start(SKAPSEKTION_PRO_GEINS_ID);
    // Base, the locked mounting rail and the glass doors that come with it.
    expect(config.unitPrice.sellingPriceExVat).toBe(5400 + 450);

    const wider = await backend.applyChanges(
      config.configurationId,
      [setVariable('cab-width', 1000)],
      CTX,
    );
    expect(wider.unitPrice.sellingPriceExVat).toBe(5400 + 450 + 2 * 200);
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
    expect(changed.unitPrice.sellingPriceExVat).toBe(
      3200 + 3 * power.unitPrice.sellingPriceExVat!,
    );
  });

  it('sends the document price in the full Geins shape, VAT from the seed', async () => {
    const config = await start();
    const exVat = config.unitPrice.sellingPriceExVat!;

    expect(config.unitPrice).toEqual({
      sellingPriceExVat: exVat,
      sellingPriceIncVat: exVat * 1.25,
      regularPriceExVat: exVat,
      regularPriceIncVat: exVat * 1.25,
      vat: exVat * 0.25,
      isDiscounted: false,
      discountPercentage: 0,
      currency: { code: 'SEK', symbol: 'kr' },
    });
  });

  it('prices a discounted row from a list price above the selling price', async () => {
    const config = await start();

    expect(findOption(config, 'acc-pegboard').unitPrice).toEqual({
      sellingPriceExVat: 900,
      sellingPriceIncVat: 1125,
      regularPriceExVat: 1200,
      regularPriceIncVat: 1500,
      vat: 225,
      isDiscounted: true,
      discountPercentage: 25,
      currency: { code: 'SEK', symbol: 'kr' },
    });
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
// Ownership
//
// The composite backend asks this before it routes a call that carries only an
// id. Every id the fixture would answer 410 for is still its own, so an expired
// fixture session is not handed to the real backend as an unknown id.
// ---------------------------------------------------------------------------

describe('owns', () => {
  it('owns a live session', async () => {
    const config = await start();
    expect(backend.owns(config.configurationId, CTX)).toBe(true);
  });

  it('still owns an expired session', async () => {
    const config = await start();
    advance(SESSION_MINUTES + 1);
    expect(backend.owns(config.configurationId, CTX)).toBe(true);
  });

  it('still owns a departed session inside the retention window', async () => {
    const config = await start();
    await backend.release(config.configurationId, CTX);
    advance(DEPARTED_RETENTION_HOURS * 60 - 1);
    expect(backend.owns(config.configurationId, CTX)).toBe(true);
  });

  it('lets a departed session go once the retention window passes', async () => {
    const config = await start();
    await backend.release(config.configurationId, CTX);
    advance(DEPARTED_RETENTION_HOURS * 60);
    expect(backend.owns(config.configurationId, CTX)).toBe(false);
  });

  it('does not own an id it never handed out', () => {
    expect(backend.owns('no-such-id', CTX)).toBe(false);
  });

  it("does not own another tenant's session", async () => {
    const config = await start();
    expect(backend.owns(config.configurationId, OTHER_TENANT)).toBe(false);
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
    expect(committed.articleNumber).toBe(ARBETSBORD_PRO_ID);
    expect(committed.quantity).toBe(2);
    expect(committed.unitPrice).toEqual(config.unitPrice);
  });

  it('freezes the discount and the weight the document carried', async () => {
    const config = await completed();

    const committed = await backend.commit(config.configurationId, CTX);

    expect(committed.discountPercent).toBe(config.discountPercent);
    expect(committed.weightPerUnit).toBe(arbetsbordPro.weightPerUnit);
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
    expect(shelves?.price).toMatchObject({
      sellingPriceExVat: 2 * 450,
      currency: { code: 'SEK' },
    });

    const power = committed.summary.find(
      (line) => line.label === 'Power strip',
    );
    expect(power?.value).toBe('1');
    expect(power?.price).toMatchObject({
      sellingPriceExVat: 550,
      currency: { code: 'SEK' },
    });
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
    expect(pegboard?.price).toEqual({
      sellingPriceExVat: 2 * 900,
      sellingPriceIncVat: 2 * 1125,
      regularPriceExVat: 2 * 1200,
      regularPriceIncVat: 2 * 1500,
      vat: 2 * 225,
      isDiscounted: true,
      discountPercentage: 25,
      currency: { code: 'SEK', symbol: 'kr' },
    });
    expect(width?.value).toBe('1400 mm');
    expect(width?.price).toEqual({
      sellingPriceExVat: 300,
      sellingPriceIncVat: 375,
      regularPriceExVat: 300,
      regularPriceIncVat: 375,
      vat: 75,
      isDiscounted: false,
      discountPercentage: 0,
      currency: { code: 'SEK', symbol: 'kr' },
    });
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
    expect(mount.readOnly).toBe(true);
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
  it('holds its crate type read-only, so no change can move it', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);

    expect(findOption(config, 'crate-ply')).toMatchObject({
      selected: true,
      readOnly: true,
    });
    expect(
      await statusOf(() =>
        backend.applyChanges(
          config.configurationId,
          [deselectOption('crate-ply')],
          CTX,
        ),
      ),
    ).toBe(422);
  });

  it('carries a row with no catalogue product, named from the option itself', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const withoutProduct = everyOption(config.sections).filter(
      (option) => option.product === null,
    );

    expect(withoutProduct.map((option) => option.id)).toEqual(['treat-oil']);
    expect(withoutProduct[0]).toMatchObject({
      name: 'Oiled finish',
      articleNumber: 'KONF-1003-TREAT-OIL',
    });
  });

  it('carries one single choice the buyer may skip, with nothing chosen', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);

    const optional = everyGroup(config.sections).filter(
      (group) => group.maxSelections === 1 && !group.minSelections,
    );
    expect(optional.map((group) => group.id)).toEqual(['top-treatment']);
    expect(optional[0]!.options.some((option) => option.selected)).toBe(false);
  });

  it('carries a chosen row of quantity 0 that a pick with no quantity chooses again, valid', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    expect(
      findOptionGroup(config, 'warranty').options.map((option) => option.id),
    ).toEqual(['warranty-none', 'warranty-1y']);
    const none = findOption(config, 'warranty-none');
    expect(none).toMatchObject({
      selected: true,
      selectionSource: 'groupRule',
      quantity: 0,
      defaultQuantity: 0,
      minQuantity: 0,
      maxQuantity: 0,
    });
    expect(config.isValid).toBe(true);

    const { quantity: _quantity, ...pick } = selectOption('warranty-1y');
    await backend.applyChanges(config.configurationId, [pick], CTX);
    const back = await backend.applyChanges(
      config.configurationId,
      [{ ...pick, optionId: 'warranty-none' }],
      CTX,
    );

    expect(findOption(back, 'warranty-none')).toMatchObject({
      selected: true,
      quantity: 0,
    });
    expect(findOption(back, 'warranty-1y').selected).toBe(false);
    expect(back.isValid).toBe(true);
  });

  it('marks one variable read-only', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);

    expect(
      everyVariable(config.sections)
        .filter((variable) => variable.readOnly)
        .map((variable) => variable.id),
    ).toEqual(['overhang']);
  });

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

  it('carries a section with choices of its own and two children', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const accessories = config.sections.find((s) => s.id === 'accessories')!;

    // Its own group renders and no menu hides it; the children stay reachable
    // through the rail and `Next`. No other seed carries both at once.
    expect(accessories.optionGroups.map((g) => g.id)).toEqual(['work-mat']);
    expect(accessories.optionGroups[0]!.options.map((o) => o.id)).toEqual([
      'mat-comfort',
      'mat-esd',
    ]);
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

    // Children and nothing of its own: the page is the menu, with one entry.
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

  it('says on the edge trim group what the steel top did to it, and only then', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const profile = (doc: Configuration) =>
      everyGroup(doc.sections).find((group) => group.id === 'edge-profile');
    expect(profile(config)?.messages).toEqual([]);

    const steel = await backend.applyChanges(
      config.configurationId,
      [selectOption('top-steel')],
      CTX,
    );
    expect(profile(steel)?.messages).toEqual([
      {
        severity: 'info',
        text: 'Only the ABS edge band fits a stainless steel top.',
      },
    ]);

    const laminate = await backend.applyChanges(
      config.configurationId,
      [selectOption('top-laminate')],
      CTX,
    );
    expect(profile(laminate)?.messages).toEqual([]);
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

describe('the fields every node carries', () => {
  it.each([
    ARBETSBORD_PRO_GEINS_ID,
    SKAPSEKTION_PRO_GEINS_ID,
    MONTERINGSSTATION_PRO_GEINS_ID,
  ])(
    'fills them on every node of %s, as the real contract does',
    async (id) => {
      const config = await start(id);

      for (const option of everyOption(config.sections)) {
        expect(option.name).not.toBe('');
        expect(option.articleNumber).toMatch(/^KONF-100\d-/);
        expect(option.description).toBe('');
        expect(option).not.toHaveProperty('productId');
        expect(typeof option.readOnly).toBe('boolean');
      }
      for (const variable of everyVariable(config.sections)) {
        expect(typeof variable.readOnly).toBe('boolean');
      }
      for (const section of everySection(config.sections)) {
        expect(section.description).toBe('');
      }
      for (const group of everyGroup(config.sections)) {
        expect(group.description).toBe('');
      }
    },
  );
});

describe('createSeedDocument', () => {
  it('builds the document from the Geins product id, as create does', () => {
    const document = createSeedDocument(ARBETSBORD_PRO_GEINS_ID, {
      configurationId: 'c1',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });

    expect(document.articleNumber).toBe(ARBETSBORD_PRO_ID);
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

// ---------------------------------------------------------------------------
// A value the provider refuses
// ---------------------------------------------------------------------------

describe('a value the rules refuse', () => {
  // The canary's own case: a time next to a length, where zero leaves the
  // provider nothing to compute a speed from. The range cannot say it, so the
  // refusal arrives only on the answer.
  it('carries an open time next to the station length', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const structure = config.sections.find((s) => s.id === 'structure')!;
    const time = structure.variables.find((v) => v.id === 'transport-time');

    expect(time).toMatchObject({
      name: 'Max transport time',
      description: 'Longest time a part may take along the station.',
      unit: 's',
      valueType: 'number',
      value: null,
      required: false,
      decimals: 2,
    });
    expect(time?.min).toBeUndefined();
    expect(time?.max).toBeUndefined();
    expect(time?.step).toBeUndefined();
  });

  it('refuses a time of zero and keeps the state it had', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const id = config.configurationId;

    expect(
      await statusOf(() =>
        backend.applyChanges(id, [setVariable('transport-time', 0)], CTX),
      ),
    ).toBe(422);

    const after = await backend.get(id, CTX);
    expect(findVariable(after, 'transport-time').value).toBeNull();
  });

  it('refuses the whole batch a refused time is part of', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);
    const id = config.configurationId;

    expect(
      await statusOf(() =>
        backend.applyChanges(
          id,
          [setVariable('length', 3000), setVariable('transport-time', 0)],
          CTX,
        ),
      ),
    ).toBe(422);

    const after = await backend.get(id, CTX);
    expect(findVariable(after, 'length').value).toBe(2400);
  });

  it('takes any other time and leaves the document as valid as it was', async () => {
    const config = await start(MONTERINGSSTATION_PRO_GEINS_ID);

    const updated = await backend.applyChanges(
      config.configurationId,
      [setVariable('transport-time', 1)],
      CTX,
    );

    expect(findVariable(updated, 'transport-time').value).toBe(1);
    expect(updated.isValid).toBe(config.isValid);
    expect(updated.unitPrice).toEqual(config.unitPrice);
  });

  it('refuses nothing on a seed without the rule', async () => {
    const config = await start();

    const updated = await backend.applyChanges(
      config.configurationId,
      [setVariable('shelves', 0)],
      CTX,
    );

    expect(findVariable(updated, 'shelves').value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The cart
// ---------------------------------------------------------------------------

describe('addToCart', () => {
  async function committedId(): Promise<string> {
    const config = await backend.applyChanges(
      (await start(ARBETSBORD_PRO_GEINS_ID, 2)).configurationId,
      [
        selectOption('legs-electric'),
        selectOption('ral-9005'),
        setVariable('shelves', 2),
      ],
      CTX,
    );
    return (await backend.commit(config.configurationId, CTX))
      .committedConfigurationId;
  }

  function withCart(
    ctx: ConfiguratorContext,
    items: { id: string; skuId?: number | null }[] = [
      { id: 'other-line', skuId: 7 },
      { id: 'line-42', skuId: 42 },
    ],
  ) {
    const addPlainItem = vi.fn(async () => ({ items }));
    return { ctx: { ...ctx, cart: { addPlainItem } }, addPlainItem };
  }

  it('adds the SKU as a plain line, there being no configured cart behind the fixture', async () => {
    const id = await committedId();
    const { ctx, addPlainItem } = withCart(CTX);

    await backend.addToCart(
      'cart-1',
      { committedConfigurationId: id, skuId: 42, quantity: 2 },
      ctx,
    );

    expect(addPlainItem).toHaveBeenCalledOnce();
    expect(addPlainItem).toHaveBeenCalledWith('cart-1', {
      skuId: 42,
      quantity: 2,
    });
  });

  it('answers the line the SKU landed on', async () => {
    const id = await committedId();
    const { ctx } = withCart(CTX);

    await expect(
      backend.addToCart(
        'cart-1',
        { committedConfigurationId: id, skuId: 42, quantity: 1 },
        ctx,
      ),
    ).resolves.toEqual({ itemId: 'line-42' });
  });

  it('answers no line when the cart shows none for the SKU', async () => {
    const id = await committedId();
    const { ctx } = withCart(CTX, [{ id: 'other-line', skuId: 7 }]);

    await expect(
      backend.addToCart(
        'cart-1',
        { committedConfigurationId: id, skuId: 42, quantity: 1 },
        ctx,
      ),
    ).resolves.toEqual({ itemId: null });
  });

  it('answers no line, and records none, when the cart comes back without items', async () => {
    const id = await committedId();
    const ctx = {
      ...CTX,
      cart: { addPlainItem: vi.fn(async () => ({ items: null })) },
    };

    await expect(
      backend.addToCart(
        'cart-1',
        { committedConfigurationId: id, skuId: 42, quantity: 1 },
        ctx,
      ),
    ).resolves.toEqual({ itemId: null });
    // Nothing keyed by the missing id, in any spelling of it.
    expect(backend.ownsLine('cart-1', 'null', CTX)).toBe(false);
    expect(backend.ownsLine('cart-1', '', CTX)).toBe(false);
  });

  it('answers no line when the cart says nothing at all', async () => {
    const id = await committedId();
    const ctx = { ...CTX, cart: { addPlainItem: vi.fn(async () => ({})) } };

    await expect(
      backend.addToCart(
        'cart-1',
        { committedConfigurationId: id, skuId: 42, quantity: 1 },
        ctx,
      ),
    ).resolves.toEqual({ itemId: null });
  });

  it('answers 404 for a committed id it never handed out, adding nothing', async () => {
    const { ctx, addPlainItem } = withCart(CTX);

    expect(
      await statusOf(() =>
        backend.addToCart(
          'cart-1',
          { committedConfigurationId: 'no-such-id', skuId: 42, quantity: 1 },
          ctx,
        ),
      ),
    ).toBe(404);
    expect(addPlainItem).not.toHaveBeenCalled();
  });

  it("answers 404 for another storefront's committed id", async () => {
    const id = await committedId();
    const { ctx, addPlainItem } = withCart(OTHER_TENANT);

    expect(
      await statusOf(() =>
        backend.addToCart(
          'cart-1',
          { committedConfigurationId: id, skuId: 42, quantity: 1 },
          ctx,
        ),
      ),
    ).toBe(404);
    expect(addPlainItem).not.toHaveBeenCalled();
  });

  it('answers 500 when the context carries no cart to add to', async () => {
    const id = await committedId();

    expect(
      await statusOf(() =>
        backend.addToCart(
          'cart-1',
          { committedConfigurationId: id, skuId: 42, quantity: 1 },
          CTX,
        ),
      ),
    ).toBe(500);
  });
});

describe('reopen', () => {
  /** A configuration with choices away from the defaults, committed and added. */
  async function addedLine(ctx = CTX) {
    const config = await backend.applyChanges(
      (await start(ARBETSBORD_PRO_GEINS_ID, 2)).configurationId,
      [
        selectOption('legs-electric'),
        selectOption('ral-9005'),
        setVariable('shelves', 2),
      ],
      ctx,
    );
    const committed = await backend.commit(config.configurationId, ctx);
    await backend.addToCart(
      'cart-1',
      {
        committedConfigurationId: committed.committedConfigurationId,
        skuId: 42,
        quantity: 2,
      },
      {
        ...ctx,
        cart: {
          addPlainItem: async () => ({ items: [{ id: 'line-42', skuId: 42 }] }),
        },
      },
    );
    return { config, committed };
  }

  it('opens a new session holding the choices the line was committed with', async () => {
    const { config } = await addedLine();

    const reopened = await backend.reopen('cart-1', 'line-42', CTX);

    expect(reopened.configurationId).not.toBe(config.configurationId);
    expect(reopened.isValid).toBe(true);
    expect(reopened.quantity).toBe(2);
    expect(reopened.unitPrice).toEqual(config.unitPrice);
    expect(reopened.sections).toEqual(config.sections);
  });

  it('answers changes on the reopened session', async () => {
    await addedLine();
    const reopened = await backend.reopen('cart-1', 'line-42', CTX);

    const changed = await backend.applyChanges(
      reopened.configurationId,
      [setVariable('shelves', 3)],
      CTX,
    );

    expect(findVariable(changed, 'shelves').value).toBe(3);
  });

  it('opens a fresh session on every reopen, none of them sharing state', async () => {
    await addedLine();
    const first = await backend.reopen('cart-1', 'line-42', CTX);
    await backend.applyChanges(
      first.configurationId,
      [setVariable('shelves', 3)],
      CTX,
    );

    const second = await backend.reopen('cart-1', 'line-42', CTX);

    expect(second.configurationId).not.toBe(first.configurationId);
    expect(findVariable(second, 'shelves').value).toBe(2);
  });

  it('answers 404 for a line it never added', async () => {
    await addedLine();

    expect(await statusOf(() => backend.reopen('cart-1', 'no-line', CTX))).toBe(
      404,
    );
    expect(await statusOf(() => backend.reopen('cart-2', 'line-42', CTX))).toBe(
      404,
    );
  });

  it("answers 404 for another storefront's line", async () => {
    await addedLine();

    expect(
      await statusOf(() => backend.reopen('cart-1', 'line-42', OTHER_TENANT)),
    ).toBe(404);
  });

  it('owns the line it added, and no other', async () => {
    await addedLine();

    expect(backend.ownsLine('cart-1', 'line-42', CTX)).toBe(true);
    expect(backend.ownsLine('cart-1', 'no-line', CTX)).toBe(false);
    expect(backend.ownsLine('cart-1', 'line-42', OTHER_TENANT)).toBe(false);
  });
});

describe('replaceLine', () => {
  const WITH_CART = (ctx: ConfiguratorContext): ConfiguratorContext => ({
    ...ctx,
    cart: {
      addPlainItem: async () => ({ items: [{ id: 'line-42', skuId: 42 }] }),
    },
  });

  async function committedWith(shelves: number, ctx = CTX) {
    const created = await backend.create(
      { productId: ARBETSBORD_PRO_GEINS_ID, quantity: 2 },
      ctx,
    );
    const config = await backend.applyChanges(
      created.configurationId,
      [
        selectOption('legs-electric'),
        selectOption('ral-9005'),
        setVariable('shelves', shelves),
      ],
      ctx,
    );
    return (await backend.commit(config.configurationId, ctx))
      .committedConfigurationId;
  }

  async function addedLine(ctx = CTX) {
    await backend.addToCart(
      'cart-1',
      {
        committedConfigurationId: await committedWith(2, ctx),
        skuId: 42,
        quantity: 2,
      },
      WITH_CART(ctx),
    );
  }

  it('makes the line reopen as the new record, keeping its id', async () => {
    await addedLine();
    const next = await committedWith(3);

    await expect(
      backend.replaceLine('cart-1', 'line-42', next, CTX),
    ).resolves.toEqual({ itemId: 'line-42' });

    const reopened = await backend.reopen('cart-1', 'line-42', CTX);
    expect(findVariable(reopened, 'shelves').value).toBe(3);
  });

  it('answers 404 for a record it never committed, and leaves the line as it was', async () => {
    await addedLine();

    expect(
      await statusOf(() =>
        backend.replaceLine('cart-1', 'line-42', 'no-record', CTX),
      ),
    ).toBe(404);
    const reopened = await backend.reopen('cart-1', 'line-42', CTX);
    expect(findVariable(reopened, 'shelves').value).toBe(2);
  });

  it('answers 404 for a line it never added', async () => {
    await addedLine();
    const next = await committedWith(3);

    expect(
      await statusOf(() => backend.replaceLine('cart-1', 'no-line', next, CTX)),
    ).toBe(404);
    expect(backend.ownsLine('cart-1', 'no-line', CTX)).toBe(false);
  });

  it("answers 404 for another storefront's line", async () => {
    await addedLine();
    const next = await committedWith(3, OTHER_TENANT);

    expect(
      await statusOf(() =>
        backend.replaceLine('cart-1', 'line-42', next, OTHER_TENANT),
      ),
    ).toBe(404);
  });
});

describe('the line refusals, by code', () => {
  async function codeOf(call: () => Promise<unknown>) {
    try {
      await call();
    } catch (error) {
      return (error as { data?: { code?: string } }).data?.code;
    }
    throw new Error('expected the call to fail');
  }

  it('codes a line it never added as gone, for a reopen and for a swap', async () => {
    expect(await codeOf(() => backend.reopen('cart-1', 'no-line', CTX))).toBe(
      'CART_LINE_GONE',
    );
    const created = await start();
    const committed = await backend.applyChanges(
      created.configurationId,
      [
        selectOption('legs-electric'),
        selectOption('ral-9005'),
        setVariable('shelves', 2),
      ],
      CTX,
    );
    const { committedConfigurationId } = await backend.commit(
      committed.configurationId,
      CTX,
    );
    expect(
      await codeOf(() =>
        backend.replaceLine('cart-1', 'no-line', committedConfigurationId, CTX),
      ),
    ).toBe('CART_LINE_GONE');
  });

  it('codes a record it never committed as not found, not as a gone line', async () => {
    expect(
      await codeOf(() =>
        backend.replaceLine('cart-1', 'line-42', 'no-record', CTX),
      ),
    ).toBe('NOT_FOUND');
  });
});
