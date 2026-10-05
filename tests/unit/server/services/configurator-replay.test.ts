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
  replayChanges,
  replayOrderLine,
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
): ConfigurationOptionGroup {
  return {
    id,
    code: id,
    name: id,
    description: '',
    available: true,
    quantityEditable: false,
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
      'a temporarily locked option',
      { trim: { selectionSource: 'temporarilyLocked' as const } },
      'trim',
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

  it('sends a choice that matches the default, since the provider accepts it', () => {
    const fresh = freshSession({
      width: { value: 1200 },
      adapter: { selected: true },
    });

    expect(replayChanges(CHOICES, fresh)).toHaveLength(4);
  });
});

describe('replayOrderLine', () => {
  const APPLIED = { ...document('fresh-1', []), isValid: true };
  const CURRENT = { ...document('fresh-1', []), templateVersion: 'now' };
  const INPUT = { productId: '1359', publicOrderId: 'order-1', row: 1 };

  let backend: Record<
    'create' | 'orderLineChoices' | 'applyChanges' | 'get' | 'release',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(() => {
    backend = {
      create: vi.fn(async () => freshSession()),
      orderLineChoices: vi.fn(async () => CHOICES),
      applyChanges: vi.fn(async () => APPLIED),
      get: vi.fn(async () => CURRENT),
      release: vi.fn(async () => undefined),
    };
  });

  const replay = (input = INPUT) =>
    replayOrderLine(backend as unknown as ConfiguratorBackend, input, CTX);

  it('creates a session of one for the product, reads the row, and applies the batch', async () => {
    const result = await replay();

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
    expect(result).toEqual({ configuration: APPLIED, replayed: true });
  });

  it('reads the row while the session is being created', async () => {
    let created!: (value: Configuration) => void;
    backend.create.mockReturnValue(
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

  it('answers the fresh session, not replayed, when a choice is gone from it', async () => {
    backend.orderLineChoices.mockResolvedValue({
      ...CHOICES,
      options: [{ id: 'gone', instanceId: '0', quantity: 1 }],
    });

    await expect(replay()).resolves.toEqual({
      configuration: freshSession(),
      replayed: false,
    });
    expect(backend.applyChanges).not.toHaveBeenCalled();
  });

  it('answers the fresh session as replayed when the provider sets every choice itself', async () => {
    backend.create.mockResolvedValue(
      freshSession({
        width: { readOnly: true },
        depth: { readOnly: true },
        adapter: { readOnly: true },
        trim: { readOnly: true },
      }),
    );

    const result = await replay();

    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(result.replayed).toBe(true);
    expect(result.configuration.configurationId).toBe('fresh-1');
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
    'answers the session as it now is, not replayed, when the provider %s',
    async (_case, failure) => {
      backend.applyChanges.mockRejectedValue(failure);

      await expect(replay()).resolves.toEqual({
        configuration: CURRENT,
        replayed: false,
      });
      expect(backend.get).toHaveBeenCalledWith('fresh-1', CTX);
    },
  );

  it('fails when the session cannot be read back after a failed batch', async () => {
    const gone = createAppError(ErrorCode.GONE, 'gone');
    backend.applyChanges.mockRejectedValue(
      createAppError(ErrorCode.VALIDATION_ERROR, 'refused'),
    );
    backend.get.mockRejectedValue(gone);

    await expect(replay()).rejects.toBe(gone);
  });

  it('releases the session it created before failing, since the page never learns its id, and fails the same when the release fails too', async () => {
    const down = createAppError(ErrorCode.EXTERNAL_API_ERROR, 'down');
    backend.applyChanges.mockRejectedValue(
      createAppError(ErrorCode.EXTERNAL_API_ERROR, 'timed out'),
    );
    backend.get.mockRejectedValue(down);

    await expect(replay()).rejects.toBe(down);
    expect(backend.release).toHaveBeenCalledWith('fresh-1', CTX);

    backend.release.mockRejectedValue(new Error('release failed'));
    await expect(replay()).rejects.toBe(down);
  });

  it('fails as a start fails when the session cannot be created', async () => {
    const refused = createAppError(ErrorCode.FORBIDDEN, 'no customer number');
    backend.create.mockRejectedValue(refused);

    await expect(replay()).rejects.toBe(refused);
    expect(backend.applyChanges).not.toHaveBeenCalled();
    expect(backend.release).not.toHaveBeenCalled();
  });
});
