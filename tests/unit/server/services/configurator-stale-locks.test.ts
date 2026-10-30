import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  staleLocks,
  withStaleLocksReleased,
} from '../../../../server/services/configurator-stale-locks';
import type { ConfiguratorBackend } from '../../../../server/services/configurator';
import { logger } from '../../../../server/utils/logger';
import type {
  Configuration,
  ConfigurationChange,
  ConfigurationMessage,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
} from '../../../../shared/types/configurator';
import { makeInitialConfiguration } from '../../../fixtures/configurator/initial';
import { findOption } from '../../../fixtures/configurator/builders';
import { fixtureConfiguratorBackend } from '../../../../server/services/configurator-fixture';

// ---------------------------------------------------------------------------
// The shapes are the ones the real provider answered on a copy of a customer
// account (2026-10-29): a buyer's pick a later choice ruled out keeps its lock
// and an error; a pick sent before its unlock looks exactly the same; the
// provider's own lock without an error is valid as it is.
// ---------------------------------------------------------------------------

const RULED_OUT: ConfigurationMessage = {
  severity: 'error',
  text: 'Valet är inte längre tillgängligt',
};

const SEED_OPTION = findOption(makeInitialConfiguration(), 'legs-fixed');

function option(
  id: string,
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return {
    ...SEED_OPTION,
    id,
    instanceId: '0',
    name: `Option ${id}`,
    articleNumber: `ART-${id}`,
    selected: false,
    available: true,
    readOnly: false,
    selectionSource: 'initial',
    messages: [],
    ...overrides,
  };
}

/** The option the ticket is about: deselected, ruled out, still locked, and saying so. */
function staleLock(
  id: string,
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return option(id, {
    selected: false,
    available: false,
    selectionSource: 'locked',
    messages: [RULED_OUT],
    ...overrides,
  });
}

function group(
  id: string,
  options: ConfigurationOption[],
  overrides: Partial<ConfigurationOptionGroup> = {},
): ConfigurationOptionGroup {
  return {
    id,
    code: id,
    name: id,
    description: '',
    available: true,
    minSelections: 1,
    maxSelections: 1,
    quantityEditable: false,
    optionGroups: [],
    options,
    messages: [],
    ...overrides,
  };
}

function section(
  id: string,
  overrides: Partial<ConfigurationSection> = {},
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
    ...overrides,
  };
}

function document(
  sections: ConfigurationSection[],
  overrides: Partial<Configuration> = {},
): Configuration {
  return {
    ...makeInitialConfiguration(),
    configurationId: 'cfg-1',
    isValid: false,
    messages: [],
    sections,
    ...overrides,
  };
}

/** One visible section holding one group with the given rows. */
function withRows(
  options: ConfigurationOption[],
  groupOverrides: Partial<ConfigurationOptionGroup> = {},
): Configuration {
  return document([
    section('s', { optionGroups: [group('g', options, groupOverrides)] }),
  ]);
}

const pick = (
  id: string,
): Extract<ConfigurationChange, { type: 'option' }> => ({
  type: 'option',
  optionId: id,
  instanceId: '0',
  selected: true,
  lock: 'none',
});

const ids = (options: ConfigurationOption[]) => options.map((o) => o.id);

describe('staleLocks', () => {
  it('finds a buyer pick a later choice ruled out', () => {
    const config = withRows([
      option('endbell', { selected: true, selectionSource: 'groupRule' }),
      staleLock('im-kit'),
    ]);

    expect(ids(staleLocks(config, [pick('seabird')]))).toEqual(['im-kit']);
  });

  it('finds the provider’s own lock in a group the choices made unavailable', () => {
    const config = withRows([staleLock('no-cable'), option('cable-5m')], {
      available: false,
    });

    expect(ids(staleLocks(config, [pick('harness')]))).toEqual(['no-cable']);
  });

  it('finds one inside a nested group', () => {
    const config = document([
      section('s', {
        optionGroups: [
          group('outer', [option('a')], {
            optionGroups: [group('inner', [staleLock('nested')])],
          }),
        ],
      }),
    ]);

    expect(ids(staleLocks(config, []))).toEqual(['nested']);
  });

  it('leaves a pick this batch sent before its unlock, which looks the same', () => {
    // Measured: the charger picked alone, its group unavailable until a battery
    // is chosen, answers exactly a stale lock's fields.
    const config = withRows([staleLock('charger')], { available: false });

    expect(staleLocks(config, [pick('charger')])).toEqual([]);
  });

  it('matches the batch’s pick by instance as well as by id', () => {
    const config = withRows([staleLock('row', { instanceId: '1' })]);

    expect(ids(staleLocks(config, [pick('row')]))).toEqual(['row']);
  });

  it('is not held back by a deselect of the same row in the batch', () => {
    const config = withRows([staleLock('row')]);
    const deselect: ConfigurationChange = {
      ...pick('row'),
      selected: false,
    };

    expect(ids(staleLocks(config, [deselect]))).toEqual(['row']);
  });

  it('ignores a variable change in the batch', () => {
    const config = withRows([staleLock('row')]);
    const change: ConfigurationChange = {
      type: 'variable',
      variableId: 'row',
      value: 1,
    };

    expect(ids(staleLocks(config, [change]))).toEqual(['row']);
  });

  it('leaves the provider’s lock that carries no error, valid as it is', () => {
    const config = withRows([staleLock('sd-16gb', { messages: [] })]);

    expect(staleLocks(config, [])).toEqual([]);
  });

  it('leaves a lock whose only message is not an error', () => {
    const config = withRows([
      staleLock('row', { messages: [{ severity: 'warning', text: 'Note' }] }),
    ]);

    expect(staleLocks(config, [])).toEqual([]);
  });

  it.each<[string, Partial<ConfigurationOption>]>([
    ['still selected', { selected: true }],
    ['still available', { available: true }],
    ['read-only', { readOnly: true }],
    ['not locked', { selectionSource: 'ruleDeselected' }],
    ['temporarily locked', { selectionSource: 'temporarilyLocked' }],
  ])('leaves a row that is %s', (_label, overrides) => {
    const config = withRows([staleLock('row', overrides)]);

    expect(staleLocks(config, [])).toEqual([]);
  });

  it('leaves a selected, locked row with an error, which the buyer can change', () => {
    const config = withRows([
      option('empty-row', {
        selected: true,
        selectionSource: 'locked',
        messages: [{ severity: 'error', text: 'Artikel måste anges' }],
      }),
    ]);

    expect(staleLocks(config, [])).toEqual([]);
  });

  it('leaves a group’s own error alone', () => {
    const config = withRows([option('a', { selected: true })], {
      messages: [{ severity: 'error', text: 'Max. 2 val' }],
    });

    expect(staleLocks(config, [])).toEqual([]);
  });

  it('leaves one in a hidden section, and in a section under a hidden one', () => {
    const config = document([
      section('hidden', {
        visible: false,
        optionGroups: [group('g1', [staleLock('in-hidden')])],
        sections: [
          section('child', {
            optionGroups: [group('g2', [staleLock('under-hidden')])],
          }),
        ],
      }),
    ]);

    expect(staleLocks(config, [])).toEqual([]);
  });

  it('finds one in a visible section under a visible one', () => {
    const config = document([
      section('parent', {
        sections: [
          section('child', {
            optionGroups: [group('g', [staleLock('deep')])],
          }),
        ],
      }),
    ]);

    expect(ids(staleLocks(config, []))).toEqual(['deep']);
  });

  it('finds every one, in document order', () => {
    const config = document([
      section('s1', { optionGroups: [group('g1', [staleLock('first')])] }),
      section('s2', { optionGroups: [group('g2', [staleLock('second')])] }),
    ]);

    expect(ids(staleLocks(config, []))).toEqual(['first', 'second']);
  });
});

describe('withStaleLocksReleased', () => {
  const CTX = { hostname: 'tenant.example.com' };

  const stuck = () =>
    withRows([
      option('endbell', { selected: true, selectionSource: 'groupRule' }),
      staleLock('im-kit', { name: 'Inductive Modem Kit' }),
    ]);
  const cleared = () => ({
    ...withRows([
      option('endbell', { selected: true, selectionSource: 'groupRule' }),
      option('im-kit', { name: 'Inductive Modem Kit', available: false }),
    ]),
    isValid: true,
  });
  const clean = () => withRows([option('a', { selected: true })]);

  const DESELECT: ConfigurationChange[] = [
    {
      type: 'option',
      optionId: 'im-kit',
      instanceId: '0',
      selected: false,
      lock: 'none',
    },
  ];

  // Built on the fixture so the stub names only the members under test.
  function stubBackend(): ConfiguratorBackend {
    return {
      ...fixtureConfiguratorBackend,
      create: vi.fn(async () => stuck()),
      get: vi.fn(async () => stuck()),
      applyChanges: vi.fn(async () => clean()),
      reopen: vi.fn(async () => clean()),
    };
  }

  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('deselects a stale lock in a change answer and answers the second document, naming it', async () => {
    const inner = stubBackend();
    const second = cleared();
    vi.mocked(inner.applyChanges)
      .mockResolvedValueOnce(stuck())
      .mockResolvedValueOnce(second);

    const answer = await withStaleLocksReleased(inner).applyChanges(
      'cfg-1',
      [pick('seabird')],
      CTX,
    );

    expect(inner.applyChanges).toHaveBeenCalledTimes(2);
    expect(inner.applyChanges).toHaveBeenNthCalledWith(
      1,
      'cfg-1',
      [pick('seabird')],
      CTX,
    );
    expect(inner.applyChanges).toHaveBeenNthCalledWith(
      2,
      'cfg-1',
      DESELECT,
      CTX,
    );
    expect(answer).toEqual({
      ...second,
      released: [
        { optionId: 'im-kit', instanceId: '0', name: 'Inductive Modem Kit' },
      ],
    });
  });

  it('sends the deselect to the session the answer names', async () => {
    const inner = stubBackend();
    vi.mocked(inner.reopen).mockResolvedValueOnce({
      ...stuck(),
      configurationId: 'reopened',
    });
    vi.mocked(inner.applyChanges).mockResolvedValueOnce(cleared());

    await withStaleLocksReleased(inner).reopen('cart-1', 'line-1', CTX);

    expect(inner.applyChanges).toHaveBeenCalledWith('reopened', DESELECT, CTX);
  });

  it('clears a reopened line the same way', async () => {
    const inner = stubBackend();
    vi.mocked(inner.reopen).mockResolvedValueOnce(stuck());
    const second = cleared();
    vi.mocked(inner.applyChanges).mockResolvedValueOnce(second);

    const answer = await withStaleLocksReleased(inner).reopen(
      'cart-1',
      'line-1',
      CTX,
    );

    expect(inner.reopen).toHaveBeenCalledWith('cart-1', 'line-1', CTX);
    expect(inner.applyChanges).toHaveBeenCalledOnce();
    expect(answer.released).toEqual([
      { optionId: 'im-kit', instanceId: '0', name: 'Inductive Modem Kit' },
    ]);
  });

  it('names a row with no name by its article number', async () => {
    const inner = stubBackend();
    vi.mocked(inner.applyChanges)
      .mockResolvedValueOnce(withRows([staleLock('row', { name: '' })]))
      .mockResolvedValueOnce(clean());

    const answer = await withStaleLocksReleased(inner).applyChanges(
      'cfg-1',
      [],
      CTX,
    );

    expect(answer.released).toEqual([
      { optionId: 'row', instanceId: '0', name: 'ART-row' },
    ]);
  });

  it('deselects every stale lock in one batch', async () => {
    const inner = stubBackend();
    vi.mocked(inner.applyChanges)
      .mockResolvedValueOnce(
        withRows([staleLock('one'), staleLock('two', { instanceId: '2' })]),
      )
      .mockResolvedValueOnce(clean());

    const answer = await withStaleLocksReleased(inner).applyChanges(
      'cfg-1',
      [],
      CTX,
    );

    expect(inner.applyChanges).toHaveBeenNthCalledWith(
      2,
      'cfg-1',
      [
        {
          type: 'option',
          optionId: 'one',
          instanceId: '0',
          selected: false,
          lock: 'none',
        },
        {
          type: 'option',
          optionId: 'two',
          instanceId: '2',
          selected: false,
          lock: 'none',
        },
      ],
      CTX,
    );
    expect(answer.released?.map((r) => r.optionId)).toEqual(['one', 'two']);
  });

  it('answers once, as the provider did, when nothing is stale', async () => {
    const inner = stubBackend();
    const first = clean();
    vi.mocked(inner.applyChanges).mockResolvedValueOnce(first);

    const answer = await withStaleLocksReleased(inner).applyChanges(
      'cfg-1',
      [pick('a')],
      CTX,
    );

    expect(inner.applyChanges).toHaveBeenCalledOnce();
    expect(answer).toBe(first);
  });

  it('answers a reopen once when nothing is stale', async () => {
    const inner = stubBackend();
    const first = clean();
    vi.mocked(inner.reopen).mockResolvedValueOnce(first);

    const answer = await withStaleLocksReleased(inner).reopen('c', 'l', CTX);

    expect(inner.applyChanges).not.toHaveBeenCalled();
    expect(answer).toBe(first);
  });

  it('does not clear the answer to its own deselect again', async () => {
    const inner = stubBackend();
    vi.mocked(inner.applyChanges)
      .mockResolvedValueOnce(stuck())
      .mockResolvedValueOnce(stuck());

    const answer = await withStaleLocksReleased(inner).applyChanges(
      'cfg-1',
      [],
      CTX,
    );

    expect(inner.applyChanges).toHaveBeenCalledTimes(2);
    expect(answer.released).toHaveLength(1);
  });

  it('answers the first document, and says so in the log, when the deselect fails', async () => {
    const inner = stubBackend();
    const first = stuck();
    vi.mocked(inner.applyChanges)
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('upstream down'));

    const answer = await withStaleLocksReleased(inner).applyChanges(
      'cfg-1',
      [],
      CTX,
    );

    expect(answer).toBe(first);
    expect(answer.released).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('cfg-1');
  });

  it('passes the buyer’s own failed change through untouched', async () => {
    const inner = stubBackend();
    const failure = new Error('refused');
    vi.mocked(inner.applyChanges).mockRejectedValueOnce(failure);

    await expect(
      withStaleLocksReleased(inner).applyChanges('cfg-1', [], CTX),
    ).rejects.toBe(failure);
  });

  it('hands every other member through as the inner backend’s own', () => {
    const inner = stubBackend();
    const backend = withStaleLocksReleased(inner);

    const wrapped = new Set(['applyChanges', 'reopen']);
    const others = Object.keys(inner).filter((key) => !wrapped.has(key));
    expect(others).toContain('create');
    expect(others).toContain('get');
    for (const key of others) {
      expect(backend[key as keyof ConfiguratorBackend], key).toBe(
        inner[key as keyof ConfiguratorBackend],
      );
    }
  });
});
