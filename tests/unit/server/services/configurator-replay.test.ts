import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Configuration,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '#shared/types/configurator';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
  OrderLineChoices,
} from '../../../../server/services/configurator';
import {
  landed,
  replayChanges,
  replayOrderLine,
  restoreConfiguration,
} from '../../../../server/services/configurator-replay';

// ---------------------------------------------------------------------------
// A configured order row replayed into a new session: one create, one batch
// built from what the row was committed with, leaving out what the fresh
// session does not let the buyer change.
// ---------------------------------------------------------------------------

vi.stubGlobal('createAppError', createAppError);
vi.stubGlobal('ErrorCode', ErrorCode);

const CTX: ConfiguratorContext = { hostname: 'tenant.example.com' };

function variable(
  id: string,
  over: Partial<ConfigurationVariable> = {},
): ConfigurationVariable {
  return {
    id,
    name: id,
    description: '',
    valueType: 'number',
    value: null,
    defaultValue: null,
    required: false,
    available: true,
    readOnly: false,
    selectionSource: 'none',
    valueSource: 'manual',
    messages: [],
    ...over,
  };
}

function option(
  id: string,
  over: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return {
    id,
    instanceId: '0',
    articleNumber: id,
    name: id,
    description: '',
    selected: false,
    available: true,
    readOnly: false,
    selectionSource: 'none',
    quantity: 1,
    defaultQuantity: 1,
    unitPrice: {},
    discountPercent: 0,
    messages: [],
    product: null,
    ...over,
  };
}

function group(
  id: string,
  options: ConfigurationOption[],
  optionGroups: ConfigurationOptionGroup[] = [],
  quantityEditable = true,
): ConfigurationOptionGroup {
  return {
    id,
    code: id,
    name: id,
    description: '',
    available: true,
    quantityEditable,
    optionGroups,
    options,
    messages: [],
  };
}

function section(
  id: string,
  parts: Partial<ConfigurationSection> = {},
): ConfigurationSection {
  return {
    id,
    name: id,
    description: '',
    visible: true,
    sections: [],
    variables: [],
    optionGroups: [],
    messages: [],
    ...parts,
  };
}

function document(id: string, sections: ConfigurationSection[]): Configuration {
  return {
    configurationId: id,
    expiresAt: '2030-01-01T00:00:00.000Z',
    isValid: false,
    articleNumber: 'M-1',
    quantity: 1,
    unitPrice: {},
    discountPercent: 0,
    templateId: 't',
    templateVersion: '1',
    messages: [],
    sections,
  };
}

/** Two variables and two options, one of each nested a level down. */
function freshSession(
  over: {
    width?: Partial<ConfigurationVariable>;
    depth?: Partial<ConfigurationVariable>;
    adapter?: Partial<ConfigurationOption>;
    trim?: Partial<ConfigurationOption>;
  } = {},
): Configuration {
  return document('fresh-1', [
    section('machine', {
      variables: [variable('width', over.width)],
      optionGroups: [group('adapters', [option('adapter', over.adapter)])],
      sections: [
        section('frame', {
          variables: [variable('depth', over.depth)],
          optionGroups: [
            group(
              'finish',
              [],
              [
                group('edges', [
                  option('trim', { instanceId: '2', ...over.trim }),
                ]),
              ],
            ),
          ],
        }),
      ],
    }),
  ]);
}

const CHOICES: OrderLineChoices = {
  productId: 1359,
  variables: [
    { id: 'width', value: 1200 },
    { id: 'depth', value: 600 },
  ],
  options: [
    { id: 'adapter', instanceId: '0', quantity: 1 },
    { id: 'trim', instanceId: '2', quantity: 3 },
  ],
};

/** The fresh session once every choice in `CHOICES` has landed on it. */
function heldSession(
  over: Parameters<typeof freshSession>[0] = {},
): Configuration {
  return {
    ...freshSession({
      ...over,
      width: { value: 1200, ...over.width },
      depth: { value: 600, ...over.depth },
      adapter: { selected: true, ...over.adapter },
      trim: { selected: true, ...over.trim },
    }),
    isValid: true,
  };
}

/** The second session a replay that did not land creates, on the defaults. */
const DEFAULTS = { ...freshSession(), configurationId: 'fresh-2' };

describe('landed', () => {
  it('holds when every variable has its value and every option is selected, nested ones included', () => {
    expect(landed(CHOICES, heldSession())).toBe(true);
  });

  it('holds for no choices at all', () => {
    expect(landed({ variables: [], options: [] }, freshSession())).toBe(true);
  });

  it.each([
    ['a pick the provider left unselected', { trim: { selected: false } }],
    ['a variable at another value', { depth: { value: 601 } }],
    ['a variable left empty', { width: { value: null } }],
  ])('does not hold for %s', (_case, over) => {
    expect(landed(CHOICES, heldSession(over))).toBe(false);
  });

  it.each([
    ['a variable', { ...CHOICES, variables: [{ id: 'height', value: 3 }] }],
    [
      'an option row under another instance',
      { ...CHOICES, options: [{ id: 'trim', instanceId: '0', quantity: 1 }] },
    ],
  ])('does not hold when %s is not in the document', (_case, choices) => {
    expect(landed(choices, heldSession())).toBe(false);
  });

  it('compares a field the provider sets as well: a different value does not hold, the same one does', () => {
    expect(
      landed(
        CHOICES,
        heldSession({
          width: { readOnly: true, valueSource: 'formula', value: 1190 },
        }),
      ),
    ).toBe(false);
    expect(
      landed(
        CHOICES,
        heldSession({ width: { readOnly: true, valueSource: 'formula' } }),
      ),
    ).toBe(true);
  });

  it('compares a locked pick as well', () => {
    expect(
      landed(
        CHOICES,
        heldSession({
          adapter: { selectionSource: 'locked', selected: false },
        }),
      ),
    ).toBe(false);
  });

  it("does not compare an option's quantity", () => {
    expect(landed(CHOICES, heldSession({ trim: { quantity: 1 } }))).toBe(true);
  });
});

describe('replayChanges', () => {
  it('sends every committed variable and option, nested ones included, as the buyer would', () => {
    expect(replayChanges(CHOICES, freshSession())).toEqual([
      { type: 'variable', variableId: 'width', value: 1200 },
      { type: 'variable', variableId: 'depth', value: 600 },
      {
        type: 'option',
        optionId: 'adapter',
        instanceId: '0',
        selected: true,
        quantity: 1,
        lock: 'none',
      },
      {
        type: 'option',
        optionId: 'trim',
        instanceId: '2',
        selected: true,
        quantity: 3,
        lock: 'none',
      },
    ]);
  });

  it.each([
    ['a readOnly variable', { width: { readOnly: true } }, 'width'],
    [
      'a locked variable',
      { depth: { selectionSource: 'locked' as const } },
      'depth',
    ],
    ['a readOnly option', { adapter: { readOnly: true } }, 'adapter'],
    [
      'a temporarily locked variable',
      { width: { selectionSource: 'temporarilyLocked' as const } },
      'width',
    ],
  ])(
    'leaves out %s, which the provider sets and would refuse',
    (_case, over, id) => {
      const changes = replayChanges(CHOICES, freshSession(over)) ?? [];

      expect(changes).toHaveLength(3);
      expect(
        changes.some(
          (change) =>
            (change.type === 'variable' && change.variableId === id) ||
            (change.type === 'option' && change.optionId === id),
        ),
      ).toBe(false);
    },
  );

  // Measured: the provider takes a change to a locked row; `locked` only says
  // why it is selected. Left out, the order's choice would silently be lost.
  it.each(['locked', 'temporarilyLocked'] as const)(
    'sends an option the fresh session shows as %s',
    (selectionSource) => {
      const changes =
        replayChanges(
          CHOICES,
          freshSession({
            adapter: { selectionSource },
            trim: { selectionSource },
          }),
        ) ?? [];

      expect(changes).toHaveLength(4);
      expect(
        changes
          .filter((change) => change.type === 'option')
          .map((change) => change.optionId),
      ).toEqual(['adapter', 'trim']);
    },
  );

  // Measured: a plain select beside a locked default leaves both selected and
  // the configuration invalid ("Max. 1 val"). The UI's rule: deselect first.
  describe('a single-choice group', () => {
    function boxes(
      defaultOver: Partial<ConfigurationOption> = {},
    ): Configuration {
      const box = group(
        'box',
        [
          option('no-box', {
            selected: true,
            selectionSource: 'locked',
            ...defaultOver,
          }),
          option('standard-box'),
        ],
        [],
        false,
      );
      box.maxSelections = 1;
      return document('fresh-1', [
        section('shipping', { optionGroups: [box] }),
      ]);
    }
    const choose = (id: string): OrderLineChoices => ({
      productId: 1359,
      variables: [],
      options: [{ id, instanceId: '0', quantity: 1 }],
    });

    it("deselects the group's current row first, then selects the order's", () => {
      expect(replayChanges(choose('standard-box'), boxes())).toEqual([
        {
          type: 'option',
          optionId: 'no-box',
          instanceId: '0',
          selected: false,
          lock: 'none',
        },
        {
          type: 'option',
          optionId: 'standard-box',
          instanceId: '0',
          selected: true,
          lock: 'none',
        },
      ]);
    });

    it("sends the order's row alone when it is already the group's choice", () => {
      expect(replayChanges(choose('no-box'), boxes())).toEqual([
        {
          type: 'option',
          optionId: 'no-box',
          instanceId: '0',
          selected: true,
          lock: 'none',
        },
      ]);
    });

    it('leaves a current row the provider holds read-only where it is', () => {
      const changes = replayChanges(
        choose('standard-box'),
        boxes({ readOnly: true }),
      );

      expect(changes).toMatchObject([
        { optionId: 'standard-box', selected: true },
      ]);
    });
  });

  it('answers an empty batch when the provider sets everything', () => {
    const fresh = freshSession({
      width: { readOnly: true },
      depth: { readOnly: true },
      adapter: { readOnly: true },
      trim: { readOnly: true },
    });

    expect(replayChanges(CHOICES, fresh)).toEqual([]);
  });

  it.each([
    ['a variable', { ...CHOICES, variables: [{ id: 'height', value: 3 }] }],
    [
      'an option',
      {
        ...CHOICES,
        options: [{ id: 'gone', instanceId: '0', quantity: 1 }],
      },
    ],
    [
      'an option row under another instance',
      {
        ...CHOICES,
        options: [{ id: 'trim', instanceId: '0', quantity: 1 }],
      },
    ],
  ])(
    'answers nothing when %s the order holds is not in the fresh session',
    (_case, choices) => {
      expect(replayChanges(choices, freshSession())).toBeNull();
    },
  );

  it('answers nothing for a missing choice the provider would set anyway: the template moved', () => {
    const fresh = freshSession({ width: { readOnly: true } });
    const choices = {
      ...CHOICES,
      variables: [...CHOICES.variables, { id: 'height', value: 3 }],
    };

    expect(replayChanges(choices, fresh)).toBeNull();
  });

  it('leaves the quantity out of a row committed at 0, which the provider refuses, and keeps one above it', () => {
    const choices = {
      ...CHOICES,
      variables: [],
      options: [
        { id: 'adapter', instanceId: '0', quantity: 0 },
        { id: 'trim', instanceId: '2', quantity: 3 },
      ],
    };

    const [zero, three] = replayChanges(choices, freshSession()) ?? [];

    expect(zero).toEqual({
      type: 'option',
      optionId: 'adapter',
      instanceId: '0',
      selected: true,
      lock: 'none',
    });
    expect(zero).not.toHaveProperty('quantity');
    expect(three).toMatchObject({ optionId: 'trim', quantity: 3 });
  });

  // The platform side's rule: a quantity goes only on the buyer's own change,
  // and the buyer can change one only in a quantity-editable group.
  it("leaves the quantity out of a row whose group's quantity the buyer cannot change", () => {
    const fresh = freshSession();
    const edges =
      fresh.sections[0]!.sections[0]!.optionGroups[0]!.optionGroups[0]!;
    edges.quantityEditable = false;

    const trim = (replayChanges(CHOICES, fresh) ?? []).find(
      (change) => change.type === 'option' && change.optionId === 'trim',
    );

    expect(trim).toMatchObject({ optionId: 'trim', selected: true });
    expect(trim).not.toHaveProperty('quantity');
  });

  it('sends a choice that matches the default, since the provider accepts it', () => {
    const fresh = freshSession({
      width: { value: 1200 },
      adapter: { selected: true },
    });

    expect(replayChanges(CHOICES, fresh)).toHaveLength(4);
  });
});

type Backend = Record<
  'create' | 'orderLineChoices' | 'applyChanges' | 'release',
  ReturnType<typeof vi.fn>
>;

function backendDouble(): Backend {
  return {
    create: vi
      .fn()
      .mockResolvedValueOnce(freshSession())
      .mockResolvedValue(DEFAULTS),
    orderLineChoices: vi.fn(async () => CHOICES),
    applyChanges: vi.fn(async () => heldSession()),
    release: vi.fn(async () => undefined),
  };
}

describe('replayOrderLine', () => {
  const INPUT = { productId: '1359', publicOrderId: 'order-1', row: 1 };

  let backend: Backend;

  beforeEach(() => {
    backend = backendDouble();
  });

  const replay = (input = INPUT) =>
    replayOrderLine(backend as unknown as ConfiguratorBackend, input, CTX);

  it('creates a session of one for the product, reads the row, and applies the batch', async () => {
    const result = await replay();

    expect(backend.create).toHaveBeenCalledOnce();
    expect(backend.create).toHaveBeenCalledWith(
      { productId: '1359', quantity: 1 },
      CTX,
    );
    expect(backend.orderLineChoices).toHaveBeenCalledWith('order-1', 1, CTX);
    expect(backend.applyChanges).toHaveBeenCalledWith(
      'fresh-1',
      replayChanges(CHOICES, freshSession()),
      CTX,
    );
    expect(backend.release).not.toHaveBeenCalled();
    expect(result).toEqual({ configuration: heldSession(), replayed: true });
  });

  it('reads the row while the session is being created', async () => {
    let created!: (value: Configuration) => void;
    backend.create.mockReset().mockReturnValue(
      new Promise<Configuration>((resolve) => {
        created = resolve;
      }),
    );

    const pending = replay();
    await Promise.resolve();
    expect(backend.orderLineChoices).toHaveBeenCalled();

    created(freshSession());
    await pending;
  });

  it.each([
    ['the row carries no choices', null],
    ['the row is another product', { ...CHOICES, productId: 7 }],
    ['the row names no product', { ...CHOICES, productId: null }],
  ])(
    'answers the fresh session, not replayed, when %s',
    async (_case, choices) => {
      backend.orderLineChoices.mockResolvedValue(choices);

      await expect(replay()).resolves.toEqual({
        configuration: freshSession(),
        replayed: false,
      });
      expect(backend.applyChanges).not.toHaveBeenCalled();
      expect(backend.create).toHaveBeenCalledOnce();
    },
  );

  it('answers the fresh session, not replayed, when the order cannot be read', async () => {
    backend.orderLineChoices.mockRejectedValue(
      createAppError(ErrorCode.EXTERNAL_API_ERROR, 'down'),
    );

    await expect(replay()).resolves.toEqual({
      configuration: freshSession(),
      replayed: false,
    });
    expect(backend.applyChanges).not.toHaveBeenCalled();
  });

  it('fails as a start fails when the session cannot be created', async () => {
    const refused = createAppError(ErrorCode.FORBIDDEN, 'no customer number');
    backend.create.mockReset().mockRejectedValue(refused);

    await expect(replay()).rejects.toBe(refused);
    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(backend.release).not.toHaveBeenCalled();
  });
});

describe('restoreConfiguration', () => {
  const INPUT = {
    productId: '1359',
    quantity: 3,
    variables: CHOICES.variables,
    options: CHOICES.options,
  };

  let backend: Backend;

  beforeEach(() => {
    backend = backendDouble();
  });

  const restore = (input = INPUT) =>
    restoreConfiguration(backend as unknown as ConfiguratorBackend, input, CTX);

  it('creates a session at the quantity it is given and replays the choices into it', async () => {
    const result = await restore();

    expect(backend.create).toHaveBeenCalledOnce();
    expect(backend.create).toHaveBeenCalledWith(
      { productId: '1359', quantity: 3 },
      CTX,
    );
    expect(backend.applyChanges).toHaveBeenCalledWith(
      'fresh-1',
      replayChanges(CHOICES, freshSession()),
      CTX,
    );
    expect(backend.orderLineChoices).not.toHaveBeenCalled();
    expect(backend.release).not.toHaveBeenCalled();
    expect(result).toEqual({ configuration: heldSession(), replayed: true });
  });

  it('answers the fresh session as replayed when there is nothing to replay', async () => {
    await expect(
      restore({ ...INPUT, variables: [], options: [] }),
    ).resolves.toEqual({ configuration: freshSession(), replayed: true });
    expect(backend.applyChanges).not.toHaveBeenCalled();
  });

  it('fails as a start fails when the session cannot be created, at that quantity or at all', async () => {
    const refused = createAppError(ErrorCode.VALIDATION_ERROR, 'quantity');
    backend.create.mockReset().mockRejectedValue(refused);

    await expect(restore()).rejects.toBe(refused);
    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(backend.release).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Both ways back answer one rule: every choice lands, or the buyer gets a new
// session on the defaults.
// ---------------------------------------------------------------------------

describe.each([
  [
    'replayOrderLine',
    (backend: Backend) =>
      replayOrderLine(
        backend as unknown as ConfiguratorBackend,
        { productId: '1359', publicOrderId: 'order-1', row: 1 },
        CTX,
      ),
    { productId: '1359', quantity: 1 },
  ],
  [
    'restoreConfiguration',
    (backend: Backend) =>
      restoreConfiguration(
        backend as unknown as ConfiguratorBackend,
        {
          productId: '1359',
          quantity: 3,
          variables: CHOICES.variables,
          options: CHOICES.options,
        },
        CTX,
      ),
    { productId: '1359', quantity: 3 },
  ],
])('%s, a replay that does not land whole', (_name, replay, created) => {
  let backend: Backend;

  beforeEach(() => {
    backend = backendDouble();
  });

  function expectDefaults(result: unknown): void {
    expect(result).toEqual({ configuration: DEFAULTS, replayed: false });
    expect(backend.release).toHaveBeenCalledExactlyOnceWith('fresh-1', CTX);
    expect(backend.create).toHaveBeenCalledTimes(2);
    expect(backend.create).toHaveBeenLastCalledWith(created, CTX);
  }

  it('answers a new session on the defaults when the provider accepts the batch but leaves a pick unselected', async () => {
    backend.applyChanges.mockResolvedValue(
      heldSession({ trim: { selected: false } }),
    );

    expectDefaults(await replay(backend));
  });

  it('answers a new session on the defaults when a variable holds another value', async () => {
    backend.applyChanges.mockResolvedValue(
      heldSession({ depth: { value: 590 } }),
    );

    expectDefaults(await replay(backend));
  });

  it('answers a new session on the defaults when a field the provider sets differs from the choices', async () => {
    backend.applyChanges.mockResolvedValue(
      heldSession({ width: { readOnly: true, value: 1190 } }),
    );

    expectDefaults(await replay(backend));
  });

  it.each([
    [
      'refuses the batch',
      createAppError(ErrorCode.VALIDATION_ERROR, 'refused'),
    ],
    [
      'fails some other way',
      createAppError(ErrorCode.EXTERNAL_API_ERROR, 'timed out'),
    ],
  ])(
    'answers a new session on the defaults when the provider %s',
    async (_case, failure) => {
      backend.applyChanges.mockRejectedValue(failure);

      expectDefaults(await replay(backend));
    },
  );

  it('still answers the defaults when the release fails', async () => {
    backend.applyChanges.mockResolvedValue(
      heldSession({ trim: { selected: false } }),
    );
    backend.release.mockRejectedValue(new Error('release failed'));

    expectDefaults(await replay(backend));
  });

  it('fails when the new session cannot be created, after releasing the first', async () => {
    const down = createAppError(ErrorCode.EXTERNAL_API_ERROR, 'down');
    backend.applyChanges.mockResolvedValue(
      heldSession({ trim: { selected: false } }),
    );
    backend.create
      .mockReset()
      .mockResolvedValueOnce(freshSession())
      .mockRejectedValue(down);

    await expect(replay(backend)).rejects.toBe(down);
    expect(backend.release).toHaveBeenCalledWith('fresh-1', CTX);
  });

  it('answers the fresh session, not replayed and not released, when a choice is gone from it', async () => {
    backend.orderLineChoices.mockResolvedValue({
      ...CHOICES,
      options: [{ id: 'gone', instanceId: '0', quantity: 1 }],
    });
    backend.create.mockReset().mockResolvedValue(freshSession());
    const result = await (_name === 'replayOrderLine'
      ? replay(backend)
      : restoreConfiguration(
          backend as unknown as ConfiguratorBackend,
          {
            ...created,
            variables: CHOICES.variables,
            options: [{ id: 'gone', instanceId: '0', quantity: 1 }],
          },
          CTX,
        ));

    expect(result).toEqual({ configuration: freshSession(), replayed: false });
    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(backend.release).not.toHaveBeenCalled();
    expect(backend.create).toHaveBeenCalledOnce();
  });

  it('answers the fresh session as replayed when the provider set every choice itself, to the same values', async () => {
    backend.create.mockReset().mockResolvedValue(
      heldSession({
        width: { readOnly: true },
        depth: { readOnly: true },
        adapter: { readOnly: true },
        trim: { readOnly: true },
      }),
    );

    const result = await replay(backend);

    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(result.replayed).toBe(true);
    expect(backend.create).toHaveBeenCalledOnce();
  });

  it('answers the fresh session, not replayed and not released, when the provider set a choice itself to another value', async () => {
    const provided = freshSession({
      width: { readOnly: true, value: 1190 },
      depth: { readOnly: true, value: 600 },
      adapter: { readOnly: true, selected: true },
      trim: { readOnly: true, selected: true },
    });
    backend.create.mockReset().mockResolvedValue(provided);

    await expect(replay(backend)).resolves.toEqual({
      configuration: provided,
      replayed: false,
    });
    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(backend.release).not.toHaveBeenCalled();
    expect(backend.create).toHaveBeenCalledOnce();
  });
});
