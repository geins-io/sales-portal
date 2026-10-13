import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ORDER_STATUSES,
  getOrderStatusLabel,
  getOrderStatusPillClass,
} from '../../app/utils/order-status';

const LOCALES_DIR = resolve(__dirname, '../../app/locales');
const LOCALES = ['sv', 'en', 'da', 'nb', 'fi', 'de'];

const t = (key: string) => `t:${key}`;

describe('getOrderStatusLabel', () => {
  it.each([
    'cancelled',
    'on-hold',
    'inactive',
    'refunded',
    'partial',
    'backorder',
    'completed',
    'pending',
  ])('translates the Geins status %s', (status) => {
    expect(getOrderStatusLabel(status, t)).toMatch(
      /^t:portal\.orders\.status\./,
    );
  });

  it('maps a hyphenated status to an underscore key', () => {
    expect(getOrderStatusLabel('on-hold', t)).toBe(
      't:portal.orders.status.on_hold',
    );
  });

  it('matches the status case-insensitively', () => {
    expect(getOrderStatusLabel('Backorder', t)).toBe(
      't:portal.orders.status.backorder',
    );
  });

  it('shows an unknown status as readable text, not a key path', () => {
    expect(getOrderStatusLabel('ready-for-pickup', t)).toBe('Ready for pickup');
    expect(getOrderStatusLabel('awaiting_payment', t)).toBe('Awaiting payment');
  });

  it('collapses repeated and edge separators in an unknown status', () => {
    expect(getOrderStatusLabel('_ready--for_pickup-', t)).toBe(
      'Ready for pickup',
    );
  });

  it('keeps an unknown status that has no separators as one word', () => {
    expect(getOrderStatusLabel('returned', t)).toBe('Returned');
  });

  it('returns an empty string when there is no status', () => {
    expect(getOrderStatusLabel(undefined, t)).toBe('');
    expect(getOrderStatusLabel(null, t)).toBe('');
    expect(getOrderStatusLabel('', t)).toBe('');
  });
});

describe('getOrderStatusPillClass', () => {
  it.each([
    ['placed', 'bg-muted text-muted-foreground'],
    ['processing', 'bg-amber-100'],
    ['shipped', 'bg-indigo-100'],
    ['delivered', 'bg-primary/10 text-primary'],
    ['completed', 'bg-primary/10 text-primary'],
    ['Cancelled', 'bg-destructive/10 text-destructive'],
  ])('gives %s its own pill', (status, cls) => {
    expect(getOrderStatusPillClass(status)).toContain(cls);
  });

  it.each([
    'on-hold',
    'inactive',
    'refunded',
    'partial',
    'backorder',
    'pending',
  ])('gives %s the default muted pill', (status) => {
    expect(getOrderStatusPillClass(status)).toBe(
      'bg-muted text-muted-foreground',
    );
  });

  it('gives a missing status the default muted pill', () => {
    expect(getOrderStatusPillClass(undefined)).toBe(
      'bg-muted text-muted-foreground',
    );
  });
});

describe('order status locale keys', () => {
  it.each(LOCALES)('%s has a label for every known status', (locale) => {
    const messages = JSON.parse(
      readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf-8'),
    ) as { portal: { orders: { status: Record<string, unknown> } } };
    const labels = messages.portal.orders.status;
    for (const status of ORDER_STATUSES) {
      const key = status.replace(/-/g, '_');
      expect(labels[key], `${locale}: ${key}`).toEqual(expect.any(String));
      expect(labels[key], `${locale}: ${key}`).not.toBe('');
    }
  });
});
