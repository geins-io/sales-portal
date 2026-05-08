import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ButtonsWidget must use bg-button-background so tenant button color is respected.
 * bg-button-background falls back to var(--primary) when no tenant value is set,
 * so this is always safe. Tested at source level (node tier).
 */
describe('ButtonsWidget button classes', () => {
  const source = readFileSync(
    resolve(__dirname, '../../app/components/cms/widgets/ButtonsWidget.vue'),
    'utf-8',
  );

  it('contains bg-button-background', () => {
    expect(source).toContain('bg-button-background');
  });

  it('does not contain bg-primary', () => {
    expect(source).not.toContain('bg-primary');
  });

  it('contains text-primary-foreground', () => {
    expect(source).toContain('text-primary-foreground');
  });
});
