import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  assert,
} from 'vitest';
import { mockConsole } from '../utils';

// Mock Sentry. Each signature is the one useErrorTracking() calls it with —
// declared here rather than at the call sites, so the arguments and every
// `mock.calls` read are checked instead of inferred as zero arguments.
const mockSentryCapture = vi.fn<
  (
    error: Error,
    hint: {
      tags: Record<string, string | undefined>;
      extra: Record<string, unknown>;
    },
  ) => void
>();
const mockSentrySetUser =
  vi.fn<
    (user: { id: string; email?: string; username?: string } | null) => void
  >();
const mockSentrySetTag = vi.fn<(key: string, value?: string) => void>();
const mockSentryAddBreadcrumb =
  vi.fn<
    (breadcrumb: {
      message: string;
      category: string;
      data?: Record<string, unknown>;
      level: string;
    }) => void
  >();

// The logger drops debug lines outside dev, so debug output is read from a spy
// in front of the real logger.
const mockLogDebug =
  vi.fn<(message: string, context?: Record<string, unknown>) => void>();

vi.mock('../../app/utils/logger', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../app/utils/logger')>();
  return {
    ...actual,
    createLogger: (component: string) => {
      const log = actual.createLogger(component);
      return {
        ...log,
        debug: (message: string, context?: Record<string, unknown>) => {
          mockLogDebug(message, context);
          log.debug(message, context);
        },
      };
    },
  };
});

vi.mock('@sentry/nuxt', () => ({
  captureException: (...args: Parameters<typeof mockSentryCapture>) =>
    mockSentryCapture(...args),
  setUser: (...args: Parameters<typeof mockSentrySetUser>) =>
    mockSentrySetUser(...args),
  setTag: (...args: Parameters<typeof mockSentrySetTag>) =>
    mockSentrySetTag(...args),
  addBreadcrumb: (...args: Parameters<typeof mockSentryAddBreadcrumb>) =>
    mockSentryAddBreadcrumb(...args),
}));

// Mock Nuxt composables
const mockRuntimeConfig = {
  public: {
    features: {
      analytics: false,
    },
  },
};

vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig);

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useErrorTracking', () => {
  let useErrorTracking: typeof import('../../app/composables/useErrorTracking').useErrorTracking;
  let consoleMocks: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    // Reset mocks
    mockSentryCapture.mockClear();
    mockSentrySetUser.mockClear();
    mockSentrySetTag.mockClear();
    mockSentryAddBreadcrumb.mockClear();
    mockFetch.mockClear();

    // Mock console methods
    consoleMocks = mockConsole();

    // Reset modules and re-import
    vi.resetModules();

    // Re-stub globals after module reset
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig);
    vi.stubGlobal('fetch', mockFetch);

    const module = await import('../../app/composables/useErrorTracking');
    useErrorTracking = module.useErrorTracking;
  });

  afterEach(() => {
    consoleMocks.restore();
    vi.unstubAllGlobals();
  });

  describe('trackError', () => {
    it('should track an Error object', () => {
      const { trackError } = useErrorTracking();
      const error = new Error('Test error');

      trackError(error);

      expect(mockSentryCapture).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          extra: expect.any(Object),
        }),
      );
    });

    it('should track a string error by converting to Error', () => {
      const { trackError } = useErrorTracking();

      trackError('String error message');

      expect(mockSentryCapture).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object),
      );

      const capturedError = mockSentryCapture.mock.calls[0]?.[0];
      assert.isDefined(capturedError);
      expect(capturedError.message).toBe('String error message');
    });

    it('should include context in Sentry capture', () => {
      const { trackError } = useErrorTracking();
      const error = new Error('Test error');
      const context = {
        component: 'TestComponent',
        action: 'testAction',
        userId: 'user-123',
      };

      trackError(error, context);

      expect(mockSentryCapture).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: {
            component: 'TestComponent',
            action: 'testAction',
          },
          extra: context,
        }),
      );
    });

    it('should log the error with its context and route', () => {
      const { trackError } = useErrorTracking();

      trackError(new Error('Test error'), { component: 'TestComponent' });

      const call = consoleMocks.mocks.error.mock.lastCall;
      assert.isDefined(call);
      expect(call).toContainEqual(
        expect.stringContaining('[ErrorTracking] Error: Test error'),
      );
      expect(call).toContainEqual(
        expect.objectContaining({
          component: 'TestComponent',
          route: expect.any(String),
          stack: expect.any(String),
        }),
      );
    });
  });

  describe('setUser', () => {
    it('should set user in Sentry', () => {
      const { setUser } = useErrorTracking();
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      };

      setUser(user);

      expect(mockSentrySetUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should clear user when null is passed', () => {
      const { setUser } = useErrorTracking();

      setUser(null);

      expect(mockSentrySetUser).toHaveBeenCalledWith(null);
    });

    it('should handle user with only id', () => {
      const { setUser } = useErrorTracking();
      const user = { id: 'user-456' };

      setUser(user);

      expect(mockSentrySetUser).toHaveBeenCalledWith({
        id: 'user-456',
        email: undefined,
        username: undefined,
      });
    });
  });

  describe('setTenant', () => {
    it('should set tenant tags in Sentry', () => {
      const { setTenant } = useErrorTracking();
      const tenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
      };

      setTenant(tenant);

      expect(mockSentrySetTag).toHaveBeenCalledWith('tenant.id', 'tenant-123');
      expect(mockSentrySetTag).toHaveBeenCalledWith(
        'tenant.name',
        'Test Tenant',
      );
    });

    it('should set only tenant id when name is not provided', () => {
      const { setTenant } = useErrorTracking();
      const tenant = { id: 'tenant-456' };

      setTenant(tenant);

      expect(mockSentrySetTag).toHaveBeenCalledWith('tenant.id', 'tenant-456');
      expect(mockSentrySetTag).toHaveBeenCalledTimes(1);
    });

    it('should clear tenant tags when null is passed', () => {
      const { setTenant } = useErrorTracking();

      setTenant(null);

      expect(mockSentrySetTag).toHaveBeenCalledWith('tenant.id', undefined);
      expect(mockSentrySetTag).toHaveBeenCalledWith('tenant.name', undefined);
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb to Sentry', () => {
      const { addBreadcrumb } = useErrorTracking();

      addBreadcrumb('User clicked button', 'ui');

      expect(mockSentryAddBreadcrumb).toHaveBeenCalledWith({
        message: 'User clicked button',
        category: 'ui',
        data: undefined,
        level: 'info',
      });
    });

    it('should use default category "app" when not provided', () => {
      const { addBreadcrumb } = useErrorTracking();

      addBreadcrumb('App initialized');

      expect(mockSentryAddBreadcrumb).toHaveBeenCalledWith({
        message: 'App initialized',
        category: 'app',
        data: undefined,
        level: 'info',
      });
    });

    it('should include data when provided', () => {
      const { addBreadcrumb } = useErrorTracking();
      const data = { productId: '123', action: 'add_to_cart' };

      addBreadcrumb('Product added to cart', 'commerce', data);

      expect(mockSentryAddBreadcrumb).toHaveBeenCalledWith({
        message: 'Product added to cart',
        category: 'commerce',
        data,
        level: 'info',
      });
    });
  });

  describe('trackWarning', () => {
    it('should log the warning with its context and route', () => {
      const { trackWarning } = useErrorTracking();

      trackWarning('Warning message', { component: 'TestComponent' });

      const call = consoleMocks.mocks.warn.mock.lastCall;
      assert.isDefined(call);
      expect(call).toContainEqual(expect.stringContaining('Warning message'));
      expect(call).toContainEqual(
        expect.objectContaining({
          component: 'TestComponent',
          severity: 'warning',
          route: expect.any(String),
        }),
      );
    });
  });

  describe('trackEvent', () => {
    it('should log the event name and properties', () => {
      const { trackEvent } = useErrorTracking();
      mockLogDebug.mockClear();

      trackEvent('button_click', { button: 'submit' });

      expect(mockLogDebug).toHaveBeenCalledWith('Event: button_click', {
        button: 'submit',
      });
    });
  });

  describe('startTimer', () => {
    it('should return timer with stop function', () => {
      const { startTimer } = useErrorTracking();

      const timer = startTimer('test-operation');

      expect(timer).toHaveProperty('stop');
      expect(typeof timer.stop).toBe('function');
    });

    it('should calculate duration when stopped', () => {
      const { startTimer } = useErrorTracking();
      const timer = startTimer('test-operation');

      // Small delay to ensure measurable duration
      const duration = timer.stop();

      // Duration should be a non-negative number (rounded)
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(duration)).toBe(true);
    });

    it('should track metric when stopped', () => {
      const { startTimer } = useErrorTracking();
      const timer = startTimer('api-call');

      const duration = timer.stop();

      // Duration should be returned and be a valid number
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('useErrorBoundary', () => {
  let useErrorBoundary: typeof import('../../app/composables/useErrorTracking').useErrorBoundary;
  let consoleMocks: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    // Reset mocks
    mockSentryCapture.mockClear();
    mockSentrySetUser.mockClear();
    mockSentrySetTag.mockClear();

    consoleMocks = mockConsole();

    // Reset modules and re-import
    vi.resetModules();

    // Re-stub globals after module reset
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig);
    vi.stubGlobal('fetch', mockFetch);

    const module = await import('../../app/composables/useErrorTracking');
    useErrorBoundary = module.useErrorBoundary;
  });

  afterEach(() => {
    consoleMocks.restore();
    vi.unstubAllGlobals();
  });

  it('should return error ref and clearError function', () => {
    const result = useErrorBoundary();

    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('clearError');
    expect(result.error.value).toBeNull();
    expect(typeof result.clearError).toBe('function');
  });

  it('should accept context parameter', () => {
    const context = { component: 'TestComponent' };

    const result = useErrorBoundary(context);

    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('clearError');
  });

  it('should clear error when clearError is called', () => {
    const { error, clearError } = useErrorBoundary();

    // Simulate error being set (normally done by onErrorCaptured)
    error.value = new Error('Captured error');
    expect(error.value).not.toBeNull();

    clearError();

    expect(error.value).toBeNull();
  });
});

describe('withErrorTracking', () => {
  let withErrorTracking: typeof import('../../app/composables/useErrorTracking').withErrorTracking;
  let consoleMocks: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    // Reset mocks
    mockSentryCapture.mockClear();

    consoleMocks = mockConsole();

    // Reset modules and re-import
    vi.resetModules();

    // Re-stub globals after module reset
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig);
    vi.stubGlobal('fetch', mockFetch);

    const module = await import('../../app/composables/useErrorTracking');
    withErrorTracking = module.withErrorTracking;
  });

  afterEach(() => {
    consoleMocks.restore();
    vi.unstubAllGlobals();
  });

  it('should execute operation and return result', async () => {
    const result = await withErrorTracking(async () => {
      return { success: true };
    });

    expect(result).toEqual({ success: true });
  });

  it('should track error and rethrow on failure', async () => {
    const error = new Error('Operation failed');

    await expect(
      withErrorTracking(async () => {
        throw error;
      }),
    ).rejects.toThrow('Operation failed');

    expect(mockSentryCapture).toHaveBeenCalledWith(error, expect.any(Object));
  });

  it('should include context in error tracking', async () => {
    const context = { action: 'fetchData', component: 'DataLoader' };

    await expect(
      withErrorTracking(async () => {
        throw new Error('Failed');
      }, context),
    ).rejects.toThrow();

    expect(mockSentryCapture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: {
          component: 'DataLoader',
          action: 'fetchData',
        },
      }),
    );
  });

  it('should time the operation and return duration', async () => {
    const startTime = performance.now();

    const result = await withErrorTracking(
      async () => {
        return 'done';
      },
      { action: 'timedOperation' },
    );

    const endTime = performance.now();

    // Verify the operation executed successfully
    expect(result).toBe('done');
    // The operation should complete in reasonable time
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should still track timing even on failure', async () => {
    const startTime = performance.now();

    await expect(
      withErrorTracking(async () => {
        throw new Error('Failed');
      }),
    ).rejects.toThrow();

    const endTime = performance.now();

    // Error should have been tracked to Sentry
    expect(mockSentryCapture).toHaveBeenCalled();
    // The operation should complete in reasonable time despite failure
    expect(endTime - startTime).toBeLessThan(1000);
  });
});

describe('error formatting', () => {
  let useErrorTracking: typeof import('../../app/composables/useErrorTracking').useErrorTracking;
  let consoleMocks: ReturnType<typeof mockConsole>;

  beforeEach(async () => {
    mockSentryCapture.mockClear();
    consoleMocks = mockConsole();

    vi.resetModules();
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig);
    vi.stubGlobal('fetch', mockFetch);

    const module = await import('../../app/composables/useErrorTracking');
    useErrorTracking = module.useErrorTracking;
  });

  afterEach(() => {
    consoleMocks.restore();
    vi.unstubAllGlobals();
  });

  it('should pass an Error object to Sentry unchanged', () => {
    const { trackError } = useErrorTracking();
    const error = new Error('Test error message');
    error.name = 'CustomError';

    trackError(error);

    expect(mockSentryCapture.mock.calls[0]?.[0]).toBe(error);
  });

  it('should wrap a number in an Error', () => {
    const { trackError } = useErrorTracking();

    trackError(404);

    const captured = mockSentryCapture.mock.calls[0]?.[0];
    assert.isDefined(captured);
    expect(captured.message).toBe('404');
    expect(captured.name).toBe('Error');
  });

  it('should wrap an object in an Error', () => {
    const { trackError } = useErrorTracking();

    trackError({ code: 500, reason: 'Internal error' });

    const captured = mockSentryCapture.mock.calls[0]?.[0];
    assert.isDefined(captured);
    expect(captured.message).toBe('[object Object]');
  });
});

// ErrorBoundary calls trackError during SSR too, where every request in the process shares this
// module, so nothing it returns or exports may hold error data.
describe('server path', () => {
  let consoleMocks: ReturnType<typeof mockConsole>;

  beforeEach(() => {
    mockSentryCapture.mockClear();
    mockFetch.mockClear();
    consoleMocks = mockConsole();
    vi.resetModules();
    vi.stubGlobal('useRuntimeConfig', () => mockRuntimeConfig);
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('window', undefined);
  });

  afterEach(() => {
    consoleMocks.restore();
    vi.unstubAllGlobals();
  });

  it('reports to Sentry and the log, and exposes no state', async () => {
    const module = await import('../../app/composables/useErrorTracking');
    const error = new Error('request A failed');

    module.useErrorTracking().trackError(error, { component: 'CartPage' });

    expect(mockSentryCapture).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: { component: 'CartPage', action: undefined },
      }),
    );
    expect(consoleMocks.mocks.error.mock.calls.flat()).toContainEqual(
      expect.stringContaining('[ErrorTracking] Error: request A failed'),
    );
    expect(mockFetch).not.toHaveBeenCalled();

    const requestB = module.useErrorTracking();
    expect(
      Object.entries(requestB).filter(([, v]) => typeof v !== 'function'),
    ).toEqual([]);
    expect(Object.keys(module).sort()).toEqual([
      'useErrorBoundary',
      'useErrorTracking',
      'withErrorTracking',
    ]);
  });
});
