import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import {
  useDebounce,
  useDebounceFn,
  useThrottleFn,
} from '../../app/composables/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const source = ref('initial');
    const debounced = useDebounce(source, 300);

    expect(debounced.value).toBe('initial');
  });

  it('should not update immediately when source changes', async () => {
    const source = ref('initial');
    const debounced = useDebounce(source, 300);

    source.value = 'updated';
    await nextTick();

    expect(debounced.value).toBe('initial');
  });

  it('should update after delay when source changes', async () => {
    const source = ref('initial');
    const debounced = useDebounce(source, 300);

    source.value = 'updated';
    await nextTick();

    vi.advanceTimersByTime(300);
    await nextTick();

    expect(debounced.value).toBe('updated');
  });

  it('should reset timer on rapid changes', async () => {
    const source = ref('initial');
    const debounced = useDebounce(source, 300);

    source.value = 'first';
    await nextTick();
    vi.advanceTimersByTime(100);

    source.value = 'second';
    await nextTick();
    vi.advanceTimersByTime(100);

    source.value = 'third';
    await nextTick();
    vi.advanceTimersByTime(300);
    await nextTick();

    expect(debounced.value).toBe('third');
  });

  it('should use default delay of 300ms', async () => {
    const source = ref('initial');
    const debounced = useDebounce(source);

    source.value = 'updated';
    await nextTick();

    vi.advanceTimersByTime(299);
    await nextTick();
    expect(debounced.value).toBe('initial');

    vi.advanceTimersByTime(1);
    await nextTick();
    expect(debounced.value).toBe('updated');
  });
});

describe('useDebounceFn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return execute, cancel, and isPending', () => {
    const fn = vi.fn();
    const result = useDebounceFn(fn, 300);

    expect(result).toHaveProperty('execute');
    expect(result).toHaveProperty('cancel');
    expect(result).toHaveProperty('isPending');
    expect(typeof result.execute).toBe('function');
    expect(typeof result.cancel).toBe('function');
  });

  it('should not call function immediately', () => {
    const fn = vi.fn();
    const { execute } = useDebounceFn(fn, 300);

    execute();

    expect(fn).not.toHaveBeenCalled();
  });

  it('should call function after delay', async () => {
    const fn = vi.fn();
    const { execute } = useDebounceFn(fn, 300);

    execute();
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to function', async () => {
    const fn = vi.fn();
    const { execute } = useDebounceFn(fn, 300);

    execute('arg1', 'arg2');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should set isPending to true when called', async () => {
    const fn = vi.fn();
    const { execute, isPending } = useDebounceFn(fn, 300);

    expect(isPending.value).toBe(false);

    execute();
    await nextTick();

    expect(isPending.value).toBe(true);
  });

  it('should set isPending to false after execution', async () => {
    const fn = vi.fn();
    const { execute, isPending } = useDebounceFn(fn, 300);

    execute();
    await nextTick();
    vi.advanceTimersByTime(300);
    await nextTick();

    expect(isPending.value).toBe(false);
  });

  it('should cancel pending execution', async () => {
    const fn = vi.fn();
    const { execute, cancel, isPending } = useDebounceFn(fn, 300);

    execute();
    await nextTick();
    cancel();
    await nextTick();

    vi.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();
    expect(isPending.value).toBe(false);
  });

  it('should debounce rapid calls', async () => {
    const fn = vi.fn();
    const { execute } = useDebounceFn(fn, 300);

    execute('first');
    vi.advanceTimersByTime(100);
    execute('second');
    vi.advanceTimersByTime(100);
    execute('third');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });
});

describe('useThrottleFn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return execute, cancel, and isPending', () => {
    const fn = vi.fn();
    const result = useThrottleFn(fn, 200);

    expect(result).toHaveProperty('execute');
    expect(result).toHaveProperty('cancel');
    expect(result).toHaveProperty('isPending');
  });

  it('should call function immediately on first call', () => {
    const fn = vi.fn();
    const { execute } = useThrottleFn(fn, 200);

    execute();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not call function again during throttle interval', () => {
    const fn = vi.fn();
    const { execute } = useThrottleFn(fn, 200);

    execute();
    execute();
    execute();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call function again after interval', async () => {
    const fn = vi.fn();
    const { execute } = useThrottleFn(fn, 200);

    execute();
    vi.advanceTimersByTime(200);
    execute();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to function', () => {
    const fn = vi.fn();
    const { execute } = useThrottleFn(fn, 200);

    execute('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should cancel pending execution', async () => {
    const fn = vi.fn();
    const { execute, cancel } = useThrottleFn(fn, 200);

    execute(); // First call executes immediately
    execute(); // Second call is throttled
    cancel();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
