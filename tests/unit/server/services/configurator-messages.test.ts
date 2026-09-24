import { describe, it, expect, vi } from 'vitest';
import {
  dropRestatedRequirements,
  withoutRestatedRequirements,
} from '../../../../server/services/configurator-messages';
import type { ConfiguratorBackend } from '../../../../server/services/configurator';
import type {
  Configuration,
  ConfigurationMessage,
  ConfigurationOption,
  ConfigurationOptionGroup,
  ConfigurationSection,
  ConfigurationVariable,
} from '../../../../shared/types/configurator';
import { makeInitialConfiguration } from '../../../fixtures/configurator/initial';
import { findOption } from '../../../fixtures/configurator/builders';
import { fixtureConfiguratorBackend } from '../../../../server/services/configurator-fixture';

// ---------------------------------------------------------------------------
// Documents are built by hand in the shape the real provider answers create
// with: every required node without an answer carries an error of its own.
// ---------------------------------------------------------------------------

const ERROR: ConfigurationMessage = {
  severity: 'error',
  text: 'Value required',
};
const WARNING: ConfigurationMessage = {
  severity: 'warning',
  text: 'Check this',
};

function variable(
  id: string,
  overrides: Partial<ConfigurationVariable> = {},
): ConfigurationVariable {
  return {
    id,
    name: id,
    description: '',
    valueType: 'number',
    value: null,
    defaultValue: null,
    required: true,
    available: true,
    selectionSource: 'none',
    valueSource: 'initial',
    messages: [],
    ...overrides,
  };
}

// The seed's row carries a real embedded product, so no product is invented here.
const SEED_OPTION = findOption(makeInitialConfiguration(), 'legs-fixed');

function option(
  id: string,
  overrides: Partial<ConfigurationOption> = {},
): ConfigurationOption {
  return {
    ...SEED_OPTION,
    id,
    instanceId: id,
    selected: false,
    messages: [],
    ...overrides,
  };
}

function group(
  id: string,
  overrides: Partial<ConfigurationOptionGroup> = {},
): ConfigurationOptionGroup {
  return {
    id,
    code: id,
    name: id,
    available: true,
    minSelections: 1,
    quantityEditable: false,
    optionGroups: [],
    options: [option(`${id}-a`), option(`${id}-b`)],
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
    isValid: false,
    messages: [],
    sections,
    ...overrides,
  };
}

/** Every message on the tree, the root's included, in walk order. */
function allMessages(config: Configuration): ConfigurationMessage[] {
  const fromGroup = (g: ConfigurationOptionGroup): ConfigurationMessage[] => [
    ...g.messages,
    ...g.options.flatMap((o) => o.messages),
    ...g.optionGroups.flatMap(fromGroup),
  ];
  const fromSection = (s: ConfigurationSection): ConfigurationMessage[] => [
    ...s.messages,
    ...s.variables.flatMap((v) => v.messages),
    ...s.optionGroups.flatMap(fromGroup),
    ...s.sections.flatMap(fromSection),
  ];
  return [...config.messages, ...config.sections.flatMap(fromSection)];
}

const onlyVariable = (config: Configuration) =>
  config.sections[0]!.variables[0]!;
const onlyGroup = (config: Configuration) =>
  config.sections[0]!.optionGroups[0]!;

describe('dropRestatedRequirements', () => {
  describe('on a variable', () => {
    it('drops an error on a required variable with no value', () => {
      const config = document([
        section('s', { variables: [variable('v', { messages: [ERROR] })] }),
      ]);
      expect(onlyVariable(dropRestatedRequirements(config)).messages).toEqual(
        [],
      );
    });

    it('drops it for an empty string too, the other shape of "no value"', () => {
      const config = document([
        section('s', {
          variables: [
            variable('v', {
              valueType: 'string',
              value: '',
              messages: [ERROR],
            }),
          ],
        }),
      ]);
      expect(onlyVariable(dropRestatedRequirements(config)).messages).toEqual(
        [],
      );
    });

    it('keeps an error on a required variable that has a value', () => {
      const config = document([
        section('s', {
          variables: [variable('v', { value: 0, messages: [ERROR] })],
        }),
      ]);
      expect(onlyVariable(dropRestatedRequirements(config)).messages).toEqual([
        ERROR,
      ]);
    });

    it('keeps an error on an empty variable that is not required', () => {
      const config = document([
        section('s', {
          variables: [variable('v', { required: false, messages: [ERROR] })],
        }),
      ]);
      expect(onlyVariable(dropRestatedRequirements(config)).messages).toEqual([
        ERROR,
      ]);
    });

    it('keeps a warning on a required variable with no value', () => {
      const config = document([
        section('s', { variables: [variable('v', { messages: [WARNING] })] }),
      ]);
      expect(onlyVariable(dropRestatedRequirements(config)).messages).toEqual([
        WARNING,
      ]);
    });

    it('drops only the error when an unmet variable carries both', () => {
      const config = document([
        section('s', {
          variables: [variable('v', { messages: [ERROR, WARNING] })],
        }),
      ]);
      expect(onlyVariable(dropRestatedRequirements(config)).messages).toEqual([
        WARNING,
      ]);
    });
  });

  describe('on an option group', () => {
    it('drops an error on a group short of its selections', () => {
      const config = document([
        section('s', { optionGroups: [group('g', { messages: [ERROR] })] }),
      ]);
      expect(onlyGroup(dropRestatedRequirements(config)).messages).toEqual([]);
    });

    it('keeps an error on a group that has its selection', () => {
      const config = document([
        section('s', {
          optionGroups: [
            group('g', {
              options: [option('g-a', { selected: true }), option('g-b')],
              messages: [ERROR],
            }),
          ],
        }),
      ]);
      expect(onlyGroup(dropRestatedRequirements(config)).messages).toEqual([
        ERROR,
      ]);
    });

    it('keeps a warning on a group short of its selections', () => {
      const config = document([
        section('s', { optionGroups: [group('g', { messages: [WARNING] })] }),
      ]);
      expect(onlyGroup(dropRestatedRequirements(config)).messages).toEqual([
        WARNING,
      ]);
    });

    it('never touches the messages on its options', () => {
      const config = document([
        section('s', {
          optionGroups: [
            group('g', {
              options: [option('g-a', { messages: [ERROR] })],
              messages: [ERROR],
            }),
          ],
        }),
      ]);
      const result = onlyGroup(dropRestatedRequirements(config));
      expect(result.messages).toEqual([]);
      expect(result.options[0]!.messages).toEqual([ERROR]);
    });
  });

  describe('walking the tree', () => {
    it('reaches a group nested inside a group, and leaves its met parent alone', () => {
      const config = document([
        section('s', {
          optionGroups: [
            group('parent', {
              minSelections: 0,
              messages: [ERROR],
              optionGroups: [group('child', { messages: [ERROR] })],
            }),
          ],
        }),
      ]);
      const parent = onlyGroup(dropRestatedRequirements(config));
      expect(parent.messages).toEqual([ERROR]);
      expect(parent.optionGroups[0]!.messages).toEqual([]);
    });

    it('reaches a section nested inside a section', () => {
      const config = document([
        section('outer', {
          sections: [
            section('inner', {
              variables: [variable('v', { messages: [ERROR] })],
              optionGroups: [group('g', { messages: [ERROR] })],
            }),
          ],
        }),
      ]);
      const inner = dropRestatedRequirements(config).sections[0]!.sections[0]!;
      expect(inner.variables[0]!.messages).toEqual([]);
      expect(inner.optionGroups[0]!.messages).toEqual([]);
    });

    it('filters a hidden section like a visible one', () => {
      const config = document([
        section('hidden', {
          visible: false,
          variables: [variable('v', { messages: [ERROR] })],
          optionGroups: [group('g', { messages: [ERROR] })],
        }),
      ]);
      const hidden = dropRestatedRequirements(config).sections[0]!;
      expect(hidden.variables[0]!.messages).toEqual([]);
      expect(hidden.optionGroups[0]!.messages).toEqual([]);
    });

    it('keeps errors on the document and on sections, which nothing can leave unmet', () => {
      const config = document(
        [
          section('s', {
            messages: [ERROR],
            variables: [variable('v', { messages: [ERROR] })],
          }),
        ],
        { messages: [ERROR] },
      );
      const result = dropRestatedRequirements(config);
      expect(result.messages).toEqual([ERROR]);
      expect(result.sections[0]!.messages).toEqual([ERROR]);
    });
  });

  it('leaves its input as it was', () => {
    const config = document([
      section('s', {
        variables: [variable('v', { messages: [ERROR] })],
        optionGroups: [
          group('g', {
            messages: [ERROR],
            optionGroups: [group('child', { messages: [ERROR] })],
          }),
        ],
        sections: [
          section('inner', {
            variables: [variable('w', { messages: [ERROR] })],
          }),
        ],
      }),
    ]);
    const before = structuredClone(config);
    dropRestatedRequirements(config);
    expect(config).toEqual(before);
  });

  it('clears a create answer in the provider shape, and nothing else', () => {
    const required = (id: string) =>
      variable(id, {
        messages: [{ severity: 'error', text: 'Mandatory variable' }],
      });
    const config = document(
      [
        section('machine', {
          variables: [variable('width', { value: 1200 }), required('depth')],
          optionGroups: [
            group('motor', {
              messages: [{ severity: 'error', text: 'Choose at least one' }],
            }),
          ],
        }),
        section('material', {
          visible: false,
          variables: [required('m1'), required('m2'), required('m3')],
          optionGroups: [
            group('bom', {
              minSelections: 0,
              options: [option('bom-a', { selected: true })],
            }),
          ],
        }),
        section('logistics', {
          visible: false,
          variables: [required('l1'), required('l2')],
        }),
      ],
      { isValid: false },
    );

    expect(allMessages(config)).toHaveLength(7);
    const result = dropRestatedRequirements(config);
    expect(allMessages(result)).toEqual([]);
    expect(result.isValid).toBe(false);
  });
});

describe('withoutRestatedRequirements', () => {
  const restating = () =>
    document([
      section('s', { variables: [variable('v', { messages: [ERROR] })] }),
    ]);

  // Built on the fixture so the stub names only the three members under test:
  // the rest of the interface can change without this file hearing of it.
  function stubBackend(): ConfiguratorBackend {
    return {
      ...fixtureConfiguratorBackend,
      create: vi.fn(async () => restating()),
      get: vi.fn(async () => restating()),
      applyChanges: vi.fn(async () => restating()),
    };
  }

  const CTX = { hostname: 'tenant.example.com' };

  it('filters what create, get and applyChanges answer', async () => {
    const inner = stubBackend();
    const backend = withoutRestatedRequirements(inner);

    const answers = [
      await backend.create({ productId: 'p', quantity: 1 }, CTX),
      await backend.get('id', CTX),
      await backend.applyChanges('id', [], CTX),
    ];
    for (const answer of answers) {
      expect(onlyVariable(answer).messages).toEqual([]);
    }
    expect(inner.create).toHaveBeenCalledWith(
      { productId: 'p', quantity: 1 },
      CTX,
    );
    expect(inner.get).toHaveBeenCalledWith('id', CTX);
    expect(inner.applyChanges).toHaveBeenCalledWith('id', [], CTX);
  });

  it('hands every other member through as the inner backend’s own', () => {
    const inner = stubBackend();
    const backend = withoutRestatedRequirements(inner);

    const filtered = new Set(['create', 'get', 'applyChanges']);
    const others = Object.keys(inner).filter((key) => !filtered.has(key));
    expect(others.length).toBeGreaterThan(0);
    for (const key of others) {
      expect(backend[key as keyof ConfiguratorBackend], key).toBe(
        inner[key as keyof ConfiguratorBackend],
      );
    }
  });

  it('passes a rejection through untouched', async () => {
    const inner = stubBackend();
    const failure = new Error('gone');
    vi.mocked(inner.get).mockRejectedValueOnce(failure);

    await expect(
      withoutRestatedRequirements(inner).get('id', CTX),
    ).rejects.toBe(failure);
  });
});
