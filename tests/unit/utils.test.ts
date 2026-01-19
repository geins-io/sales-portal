import { describe, it, expect } from 'vitest';
import { cn } from '../../app/lib/utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('px-4', 'py-2', 'bg-primary');
    expect(result).toBe('px-4 py-2 bg-primary');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toBe('base-class active-class');
  });

  it('should handle falsy values', () => {
    const result = cn('base', false, null, undefined, '', 'valid');
    expect(result).toBe('base valid');
  });

  it('should merge conflicting tailwind classes', () => {
    // tailwind-merge should resolve conflicts
    const result = cn('px-4', 'px-6');
    expect(result).toBe('px-6');
  });

  it('should handle object syntax', () => {
    const result = cn({
      'bg-primary': true,
      'text-white': true,
      hidden: false,
    });
    expect(result).toBe('bg-primary text-white');
  });

  it('should handle array syntax', () => {
    const result = cn(['px-4', 'py-2'], 'bg-primary');
    expect(result).toBe('px-4 py-2 bg-primary');
  });
});
