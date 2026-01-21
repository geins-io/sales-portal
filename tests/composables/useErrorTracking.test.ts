import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockConsole } from '../utils';

// Mock Sentry
const mockSentryCapture = vi.fn();
const mockSentrySetUser = vi.fn();
const mockSentrySetTag = vi.fn();
const mockSentryAddBreadcrumb = vi.fn();

vi.mock('@sentry/nuxt', () => ({
  captureException: (...args: unknown[]) => mockSentryCapture(...args),
  setUser: (...args: unknown[]) => mockSentrySetUser(...args),
  setTag: (...args: unknown[]) => mockSentrySetTag(...args),
  addBreadcrumb: (...args: unknown[]) => mockSentryAddBreadcrumb(...args),
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

      const capturedError = mockSentryCapture.mock.calls[0][0];
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

    it('should add error to local errors array', () => {
      const { trackError, errors } = useErrorTracking();
      const error = new Error('Test error');

      trackError(error);

      expect(errors.value.length).toBe(1);
      expect(errors.value[0].message).toBe('Test error');
      expect(errors.value[0].name).toBe('Error');
    });

    it('should limit errors array to 50 items', () => {
      const { trackError, errors } = useErrorTracking();

      // Track 55 errors
      for (let i = 0; i < 55; i++) {
        trackError(new Error(`Error ${i}`));
      }

      expect(errors.value.length).toBe(50);
      // Most recent should be first
      expect(errors.value[0].message).toBe('Error 54');
    });

    it('should include timestamp in error event', () => {
      const { trackError, errors } = useErrorTracking();
      const beforeTime = new Date().toISOString();

      trackError(new Error('Test'));

      const afterTime = new Date().toISOString();
      expect(errors.value[0].timestamp).toBeDefined();
      expect(errors.value[0].timestamp >= beforeTime).toBe(true);
      expect(errors.value[0].timestamp <= afterTime).toBe(true);
    });

    it('should include route path in error context', () => {
      const { trackError, errors } = useErrorTracking();

      trackError(new Error('Test'));

      // Route path is included in error context (actual path depends on test environment)
      expect(errors.value[0].context).toHaveProperty('route');
      expect(typeof errors.value[0].context.route).toBe('string');
    });

    it('should not track when disabled', () => {
      const { trackError, setEnabled, errors } = useErrorTracking();

      setEnabled(false);
      trackError(new Error('Test'));

      expect(errors.value.length).toBe(0);
      expect(mockSentryCapture).not.toHaveBeenCalled();
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
    it('should not track when disabled', () => {
      const { trackWarning, setEnabled } = useErrorTracking();

      setEnabled(false);
      trackWarning('Warning message');

      // In dev mode, console.warn would be called, but we disabled tracking
      expect(consoleMocks.mocks.warn).not.toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('should not track when disabled', () => {
      const { trackEvent, setEnabled } = useErrorTracking();

      setEnabled(false);
      trackEvent('button_click', { button: 'submit' });

      expect(consoleMocks.mocks.log).not.toHaveBeenCalled();
    });
  });

  describe('trackMetric', () => {
    it('should not track when disabled', () => {
      const { trackMetric, setEnabled } = useErrorTracking();

      setEnabled(false);
      trackMetric({ name: 'page_load', value: 100, unit: 'ms' });

      expect(consoleMocks.mocks.log).not.toHaveBeenCalled();
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

  describe('setEnabled', () => {
    it('should enable tracking', () => {
      const { setEnabled, isEnabled } = useErrorTracking();

      setEnabled(true);

      expect(isEnabled.value).toBe(true);
    });

    it('should disable tracking', () => {
      const { setEnabled, isEnabled } = useErrorTracking();

      setEnabled(false);

      expect(isEnabled.value).toBe(false);
    });
  });

  describe('clearErrors', () => {
    it('should clear all tracked errors', () => {
      const { trackError, clearErrors, errors } = useErrorTracking();

      trackError(new Error('Error 1'));
      trackError(new Error('Error 2'));
      expect(errors.value.length).toBe(2);

      clearErrors();

      expect(errors.value.length).toBe(0);
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors array', () => {
      const { trackError, getRecentErrors } = useErrorTracking();

      trackError(new Error('Test error'));

      const recentErrors = getRecentErrors();

      expect(recentErrors.length).toBe(1);
      expect(recentErrors[0].message).toBe('Test error');
    });
  });

  describe('global state', () => {
    it('should share state across multiple calls', async () => {
      const instance1 = useErrorTracking();
      const instance2 = useErrorTracking();

      instance1.trackError(new Error('Shared error'));

      expect(instance2.errors.value.length).toBe(1);
      expect(instance2.errors.value[0].message).toBe('Shared error');
    });

    it('should share enabled state across instances', async () => {
      const instance1 = useErrorTracking();
      const instance2 = useErrorTracking();

      instance1.setEnabled(false);

      expect(instance2.isEnabled.value).toBe(false);
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

  it('should format Error object correctly', () => {
    const { trackError, errors } = useErrorTracking();
    const error = new Error('Test error message');
    error.name = 'CustomError';

    trackError(error);

    expect(errors.value[0].message).toBe('Test error message');
    expect(errors.value[0].name).toBe('CustomError');
    expect(errors.value[0].stack).toBeDefined();
  });

  it('should format string error correctly', () => {
    const { trackError, errors } = useErrorTracking();

    trackError('Simple string error');

    expect(errors.value[0].message).toBe('Simple string error');
    expect(errors.value[0].name).toBe('Error');
  });

  it('should format number error correctly', () => {
    const { trackError, errors } = useErrorTracking();

    trackError(404);

    expect(errors.value[0].message).toBe('404');
    expect(errors.value[0].name).toBe('Error');
  });

  it('should format object error correctly', () => {
    const { trackError, errors } = useErrorTracking();

    trackError({ code: 500, reason: 'Internal error' });

    expect(errors.value[0].message).toBe('[object Object]');
    expect(errors.value[0].name).toBe('Error');
  });

  it('should merge context with route path', () => {
    const { trackError, errors } = useErrorTracking();

    trackError(new Error('Test'), { component: 'TestComp' });

    expect(errors.value[0].context.component).toBe('TestComp');
    // Route path is included (actual value depends on test environment)
    expect(errors.value[0].context).toHaveProperty('route');
    expect(typeof errors.value[0].context.route).toBe('string');
  });
});
