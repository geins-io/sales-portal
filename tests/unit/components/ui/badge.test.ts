import { describe, it, expect } from 'vitest';
import { badgeVariants } from '../../../../app/components/ui/badge';

const RAW_PALETTE =
  /(bg|text|border)-(emerald|green|amber|yellow|orange|lime|red|blue|sky|indigo)-[0-9]/;

describe('badgeVariants status tones', () => {
  it.each([
    ['neutral', ['bg-neutral-500/10', 'text-neutral-600']],
    ['info', ['bg-info/10', 'text-info']],
    ['success', ['bg-success/8', 'text-success']],
    ['success-solid', ['bg-success', 'text-white']],
    ['warning', ['bg-warning/10', 'text-warning']],
    ['destructive-soft', ['bg-danger/10', 'text-danger']],
    ['draft', ['border-dashed', 'border-neutral-300', 'text-muted-foreground']],
  ] as const)('%s uses its tone classes', (variant, expected) => {
    const classes = badgeVariants({ variant }).split(' ');
    for (const cls of expected) expect(classes).toContain(cls);
  });

  it.each([
    'info',
    'success',
    'success-solid',
    'warning',
    'destructive-soft',
  ] as const)(
    '%s is built from theme tokens, not palette colours',
    (variant) => {
      expect(badgeVariants({ variant })).not.toMatch(RAW_PALETTE);
    },
  );
});
