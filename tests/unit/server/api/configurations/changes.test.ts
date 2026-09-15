import { describe, it, expect, beforeEach } from 'vitest';
import type { ConfigurationChange } from '../../../../../shared/types/configurator';
import { makeInitialConfiguration } from '../../../../fixtures/configurator';
import {
  CTX,
  backend,
  bodyReads,
  headersOf,
  lifecycleCases,
  makeEvent,
  resetHarness,
  type RouteHandler,
} from './harness';

const CONFIGURATION = makeInitialConfiguration();
const ID = CONFIGURATION.configurationId;

const QUANTITY: ConfigurationChange = { type: 'quantity', quantity: 3 };

const VARIABLE: ConfigurationChange = {
  type: 'variable',
  variableId: 'width',
  value: 1600,
};

const OPTION: ConfigurationChange = {
  type: 'option',
  optionId: 'ral-9016',
  instanceId: '0',
  selected: true,
  quantity: 1,
  lock: 'none',
};

function eventWith(changes: unknown) {
  return makeEvent({ id: ID, body: { changes } });
}

function validEvent(
  init: {
    authenticated?: boolean;
    mode?: 'commerce' | 'catalog';
    withoutConfig?: boolean;
  } = {},
) {
  return makeEvent({ ...init, id: ID, body: { changes: [QUANTITY] } });
}

describe('POST /api/configurations/:id/changes', () => {
  let handler: RouteHandler;

  beforeEach(async () => {
    resetHarness();
    handler = (
      await import('../../../../../server/api/configurations/[id]/changes.post')
    ).default;
  });

  it('passes the batch to the backend and returns the new document', async () => {
    backend.applyChanges.mockResolvedValue(CONFIGURATION);
    const batch = [QUANTITY, VARIABLE, OPTION];
    const event = eventWith(batch);

    const result = await handler(event);

    expect(result).toBe(CONFIGURATION);
    expect(backend.applyChanges).toHaveBeenCalledWith(ID, batch, CTX);
    expect(headersOf(event)['Cache-Control']).toBe('private, no-store');
  });

  it('accepts a full batch of 100 changes', async () => {
    backend.applyChanges.mockResolvedValue(CONFIGURATION);
    const batch = Array.from({ length: 100 }, () => ({ ...QUANTITY }));

    await handler(eventWith(batch));

    expect(backend.applyChanges).toHaveBeenCalledWith(ID, batch, CTX);
  });

  it('accepts the locks the contract allows and leaves them to the engine', async () => {
    backend.applyChanges.mockResolvedValue(CONFIGURATION);
    const batch: ConfigurationChange[] = [
      { ...OPTION, lock: 'lock' },
      { ...OPTION, lock: 'unlock' },
    ];

    await handler(eventWith(batch));

    expect(backend.applyChanges).toHaveBeenCalledWith(ID, batch, CTX);
  });

  it('accepts a variable set to each value type the contract allows', async () => {
    backend.applyChanges.mockResolvedValue(CONFIGURATION);
    const batch: ConfigurationChange[] = [
      { type: 'variable', variableId: 'a', value: 'text' },
      { type: 'variable', variableId: 'b', value: 12 },
      { type: 'variable', variableId: 'c', value: true },
      { type: 'variable', variableId: 'd', value: null },
    ];

    await handler(eventWith(batch));

    expect(backend.applyChanges).toHaveBeenCalledWith(ID, batch, CTX);
  });

  describe('the body it refuses with 400', () => {
    const refused: [string, unknown][] = [
      ['no changes key', {}],
      ['changes that is not an array', { changes: QUANTITY }],
      ['an empty batch', { changes: [] }],
      [
        'a batch over the cap of 100',
        { changes: Array.from({ length: 101 }, () => ({ ...QUANTITY })) },
      ],
      ['an unknown change type', { changes: [{ type: 'colour', value: 1 }] }],
      ['a change with no type', { changes: [{ quantity: 2 }] }],
      ['a quantity of zero', { changes: [{ type: 'quantity', quantity: 0 }] }],
      [
        'a fractional quantity',
        { changes: [{ type: 'quantity', quantity: 1.5 }] },
      ],
      [
        'a variable with an empty id',
        { changes: [{ type: 'variable', variableId: '', value: 1 }] },
      ],
      [
        'a variable value the contract has no room for',
        { changes: [{ type: 'variable', variableId: 'a', value: { x: 1 } }] },
      ],
      [
        'an option with no instanceId',
        { changes: [{ ...OPTION, instanceId: undefined }] },
      ],
      [
        'an option with an empty instanceId',
        { changes: [{ ...OPTION, instanceId: '' }] },
      ],
      [
        'an option with an empty optionId',
        { changes: [{ ...OPTION, optionId: '' }] },
      ],
      ['an option with no lock', { changes: [{ ...OPTION, lock: undefined }] }],
      [
        'an option with an unknown lock',
        { changes: [{ ...OPTION, lock: 'pin' }] },
      ],
      [
        'an option with no selected flag',
        { changes: [{ ...OPTION, selected: undefined }] },
      ],
      ['an option quantity of zero', { changes: [{ ...OPTION, quantity: 0 }] }],
    ];

    it.each(refused)('answers 400 on %s', async (_case, body) => {
      await expect(handler(makeEvent({ id: ID, body }))).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(bodyReads).toHaveBeenCalled();
      expect(backend.applyChanges).not.toHaveBeenCalled();
    });
  });

  lifecycleCases({
    handler: () => handler,
    method: 'applyChanges',
    event: validEvent,
    operation: 'configurator.applyChanges',
    result: CONFIGURATION,
  });
});
