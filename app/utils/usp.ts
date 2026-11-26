/**
 * USP (Create widget template `usp`): selling points, each a Material icon
 * named as fonts.google.com/icons shows it, a heading and a short text.
 */
import { cssColor } from '~/utils/cards-rich';

export interface UspItem {
  /** The Iconify name to render, or '' for no icon. */
  icon: string;
  heading: string;
  description: string;
}

export interface UspBlock {
  /** '' = none. Otherwise a validated CSS colour. */
  backgroundColor: string;
  textColor: string;
  heading: string;
  description: string;
  items: UspItem[];
}

type Raw = Record<string, unknown>;

function record(value: unknown): Raw | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Raw)
    : undefined;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ICON_NAME_LENGTH = 64;

/**
 * `local_shipping` or `Local Shipping` → the bundled rounded outline icon,
 * `material-symbols:local-shipping-outline-rounded`. '' when there is no
 * usable name; the pattern also keeps odd input out of the icon request.
 */
export function uspIconName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const name = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (name.length > MAX_ICON_NAME_LENGTH || !ICON_NAME.test(name)) return '';
  return `material-symbols:${name}-outline-rounded`;
}

/** Per row from desktop: all when 4 or fewer, else the fewest even rows. */
export function uspDesktopPerRow(count: number): number {
  if (count <= 4) return Math.max(count, 1);
  return Math.ceil(count / Math.ceil(count / 4));
}

/** Per row on a tablet: at most 3, and 2 where desktop has 4 (4 sit 2 + 2). */
export function uspTabletPerRow(count: number): number {
  const desktop = uspDesktopPerRow(count);
  return desktop === 4 ? 2 : Math.min(desktop, 3);
}

function readItem(raw: unknown): UspItem | null {
  const item = record(raw);
  if (!item) return null;
  const read = {
    icon: uspIconName(item.icon),
    heading: str(item.heading),
    description: str(item.description),
  };
  return read.icon || read.heading || read.description ? read : null;
}

export function readUsp(data: unknown): UspBlock {
  const block = record(data) ?? {};
  const settings = record(block.settings) ?? {};
  const header = record(block.header) ?? {};
  return {
    backgroundColor: cssColor(settings.backgroundColor),
    textColor: cssColor(settings.textColor),
    heading: str(header.heading),
    description: str(header.description),
    items: Array.isArray(block.items)
      ? block.items
          .map(readItem)
          .filter((item): item is UspItem => item !== null)
      : [],
  };
}
