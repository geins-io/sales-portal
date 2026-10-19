import { describe, it, expect } from 'vitest';
import { resolveImageFileName } from '../../shared/types/cms';

describe('resolveImageFileName', () => {
  it('returns an empty name for a widget without an image', () => {
    expect(resolveImageFileName(undefined)).toBe('');
  });
});
