export const MENU_LOCATION = {
  MAIN: 'main',
  FOOTER: 'footer',
} as const;

export type MenuLocationId = (typeof MENU_LOCATION)[keyof typeof MENU_LOCATION];
