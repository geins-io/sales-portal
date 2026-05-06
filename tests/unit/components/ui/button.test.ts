import { describe, it, expect } from 'vitest';
import { buttonVariants } from '../../../../app/components/ui/button';

describe('buttonVariants surface tokens', () => {
  it('default variant uses bg-button-background with mirrored hover', () => {
    const classes = buttonVariants({ variant: 'default' });
    expect(classes).toContain('bg-button-background');
    expect(classes).toContain('hover:bg-button-background/90');
    expect(classes).toContain('text-primary-foreground');
    expect(classes).not.toContain('bg-primary ');
  });

  it('purchase variant uses bg-button-purchase-background with mirrored hover', () => {
    const classes = buttonVariants({ variant: 'purchase' });
    expect(classes).toContain('bg-button-purchase-background');
    expect(classes).toContain('hover:bg-button-purchase-background/90');
    expect(classes).toContain('text-primary-foreground');
  });

  it('keeps existing destructive / ghost / link variants untouched', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain(
      'bg-destructive',
    );
    expect(buttonVariants({ variant: 'ghost' })).toContain('hover:bg-accent');
    expect(buttonVariants({ variant: 'link' })).toContain('underline-offset-4');
  });
});
