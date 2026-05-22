import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

export const poweredByVariants = cva(
  'text-footer-text/70 hover:text-footer-text inline-flex items-center gap-1.5 text-xs transition-colors',
  {
    variants: {
      variant: {
        full: '',
        minimal: '',
      },
    },
    defaultVariants: {
      variant: 'full',
    },
  },
);

export type PoweredByVariants = VariantProps<typeof poweredByVariants>;
