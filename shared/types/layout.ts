export const headerAuthStates = ['logged-out', 'logged-in'] as const;

export type HeaderAuthState = (typeof headerAuthStates)[number];

export const headerVariants = [
  'default',
  'logged-in',
  'logged-in-light',
] as const;

export type HeaderVariant = (typeof headerVariants)[number];

export type AccountState = 'logged-in' | 'logged-out';

export interface HeaderNavLink {
  label: string;
  href: string;
  hasDropdown?: boolean;
}
