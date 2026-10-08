import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Configuration } from '#shared/types/configurator';
import { createAppError, ErrorCode } from '../../../../server/utils/errors';
import { logger } from '../../../../server/utils/logger';
import type {
  ConfiguratorBackend,
  ConfiguratorContext,
} from '../../../../server/services/configurator';
import { changeConfiguredQuantity } from '../../../../server/services/configured-line-quantity';

// ---------------------------------------------------------------------------
// A configured line at a new quantity: reopened, the quantity changed in the
// session, committed, and the commit swapped onto the same line at that
// quantity. Until the swap, the line is as it was.
// ---------------------------------------------------------------------------

const CTX: ConfiguratorContext = { hostname: 'tenant.example.com' };
const SESSION = 'session-1';
const COMMITTED = 'committed-2';

function document(isValid = true) {
  return { configurationId: SESSION, quantity: 1, isValid } as Configuration;
}

let backend: {
  [K in
    | 'reopen'
    | 'applyChanges'
    | 'commit'
    | 'release'
    | 'replaceLine']: ReturnType<typeof vi.fn>;
};
let warn: ReturnType<typeof vi.spyOn>;

const change = () =>
  changeConfiguredQuantity(
    backend as unknown as ConfiguratorBackend,
    'cart-1',
    'item-1',
    4,
    CTX,
  );

beforeEach(() => {
  backend = {
    reopen: vi.fn(async () => document()),
    applyChanges: vi.fn(async () => ({ ...document(), quantity: 4 })),
    commit: vi.fn(async () => ({ committedConfigurationId: COMMITTED })),
    release: vi.fn(async () => undefined),
    replaceLine: vi.fn(async () => ({ itemId: 'item-1' })),
  };
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

const order = () =>
  Object.entries(backend)
    .flatMap(([name, call]) =>
      call.mock.invocationCallOrder.map((at: number) => [at, name] as const),
    )
    .sort(([a], [b]) => a - b)
    .map(([, name]) => name);

describe('changeConfiguredQuantity', () => {
  it('reopens the line, sends the quantity, commits and swaps the commit onto the line at that quantity', async () => {
    await expect(change()).resolves.toBeUndefined();

    expect(order()).toEqual([
      'reopen',
      'applyChanges',
      'commit',
      'replaceLine',
    ]);
    expect(backend.reopen).toHaveBeenCalledWith('cart-1', 'item-1', CTX);
    expect(backend.applyChanges).toHaveBeenCalledWith(
      SESSION,
      [{ type: 'quantity', quantity: 4 }],
      CTX,
    );
    expect(backend.commit).toHaveBeenCalledWith(SESSION, CTX);
    expect(backend.replaceLine).toHaveBeenCalledWith(
      'cart-1',
      'item-1',
      COMMITTED,
      CTX,
      4,
    );
    expect(backend.release).not.toHaveBeenCalled();
  });

  it('passes a refused reopen on, with no session to release and the line untouched', async () => {
    const refused = createAppError(
      ErrorCode.VALIDATION_ERROR,
      'not reopenable',
    );
    backend.reopen.mockRejectedValue(refused);

    await expect(change()).rejects.toBe(refused);
    expect(order()).toEqual(['reopen']);
  });

  it('releases the session and passes the refusal on when the quantity is refused', async () => {
    const refused = createAppError(ErrorCode.VALIDATION_ERROR, 'refused');
    backend.applyChanges.mockRejectedValue(refused);

    await expect(change()).rejects.toBe(refused);
    expect(backend.release).toHaveBeenCalledWith(SESSION, CTX);
    expect(backend.commit).not.toHaveBeenCalled();
    expect(backend.replaceLine).not.toHaveBeenCalled();
  });

  it('releases the session and answers 422 without committing when the quantity leaves it invalid', async () => {
    backend.applyChanges.mockResolvedValue(document(false));

    await expect(change()).rejects.toMatchObject({ statusCode: 422 });
    expect(backend.release).toHaveBeenCalledWith(SESSION, CTX);
    expect(backend.commit).not.toHaveBeenCalled();
    expect(backend.replaceLine).not.toHaveBeenCalled();
  });

  it('releases the session when the commit fails', async () => {
    const failed = new Error('commit failed');
    backend.commit.mockRejectedValue(failed);

    await expect(change()).rejects.toBe(failed);
    expect(backend.release).toHaveBeenCalledWith(SESSION, CTX);
    expect(backend.replaceLine).not.toHaveBeenCalled();
  });

  it('passes a failed swap on and releases nothing, since the commit ended the session', async () => {
    const failed = new Error('swap failed');
    backend.replaceLine.mockRejectedValue(failed);

    await expect(change()).rejects.toBe(failed);
    expect(backend.release).not.toHaveBeenCalled();
  });

  it('warns once that the commit is left without a line when the swap fails', async () => {
    backend.replaceLine.mockRejectedValue(new Error('swap failed'));

    await expect(change()).rejects.toThrow('swap failed');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[configurator] a quantity change committed but could not swap the line',
    );
  });

  it('warns of nothing when the change goes through', async () => {
    await change();

    expect(warn).not.toHaveBeenCalled();
  });

  it('answers the original failure, with one warning, when the release fails too', async () => {
    const refused = new Error('refused');
    backend.applyChanges.mockRejectedValue(refused);
    backend.release.mockRejectedValue(new Error('release failed'));

    await expect(change()).rejects.toBe(refused);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[configurator] a quantity change could not release its session',
    );
  });
});
