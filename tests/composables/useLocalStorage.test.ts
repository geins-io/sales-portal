import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  removeFromLocalStorage,
  removeFromSessionStorage,
  clearLocalStorage,
  clearSessionStorage,
} from '../../app/composables/useLocalStorage';
import { createMockLocalStorage } from '../utils';

describe('Storage utility functions', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;
  let mockSessionStorage: ReturnType<typeof createMockLocalStorage>;
  let originalLocalStorage: Storage;
  let originalSessionStorage: Storage;

  beforeEach(() => {
    // Save original implementations
    originalLocalStorage = globalThis.localStorage;
    originalSessionStorage = globalThis.sessionStorage;

    // Create mocks
    mockLocalStorage = createMockLocalStorage();
    mockSessionStorage = createMockLocalStorage();

    // Set up mocks
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });

    // Mock import.meta.client
    vi.stubGlobal('import', {
      meta: {
        client: true,
      },
    });
  });

  afterEach(() => {
    // Restore original implementations
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
    });
    vi.unstubAllGlobals();
  });

  describe('removeFromLocalStorage', () => {
    it('should call localStorage.removeItem with the correct key', () => {
      mockLocalStorage._store['test-key'] = 'test-value';

      removeFromLocalStorage('test-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('removeFromSessionStorage', () => {
    it('should call sessionStorage.removeItem with the correct key', () => {
      mockSessionStorage._store['test-key'] = 'test-value';

      removeFromSessionStorage('test-key');

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('clearLocalStorage', () => {
    it('should call localStorage.clear', () => {
      clearLocalStorage();

      expect(mockLocalStorage.clear).toHaveBeenCalled();
    });
  });

  describe('clearSessionStorage', () => {
    it('should call sessionStorage.clear', () => {
      clearSessionStorage();

      expect(mockSessionStorage.clear).toHaveBeenCalled();
    });
  });
});

describe('Mock localStorage helper', () => {
  it('should create a functioning mock localStorage', () => {
    const mock = createMockLocalStorage();

    // Set item
    mock.setItem('key', 'value');
    expect(mock.getItem('key')).toBe('value');

    // Remove item
    mock.removeItem('key');
    expect(mock.getItem('key')).toBeNull();

    // Clear
    mock.setItem('key1', 'value1');
    mock.setItem('key2', 'value2');
    mock.clear();
    expect(mock.getItem('key1')).toBeNull();
    expect(mock.getItem('key2')).toBeNull();
  });

  it('should track call counts', () => {
    const mock = createMockLocalStorage();

    mock.setItem('key', 'value');
    mock.getItem('key');
    mock.removeItem('key');

    expect(mock.setItem).toHaveBeenCalledTimes(1);
    expect(mock.getItem).toHaveBeenCalledTimes(1);
    expect(mock.removeItem).toHaveBeenCalledTimes(1);
  });
});
