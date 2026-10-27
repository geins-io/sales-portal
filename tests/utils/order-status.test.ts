import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ORDER_STATUSES,
  ORDER_STATUS_VARIANT,
  getOrderStatusLabel,
  getOrderStatusVariant,
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

describe('getOrderStatusVariant', () => {
  it.each([
    ['placed', 'neutral'],
    ['pending', 'neutral'],
    ['refunded', 'neutral'],
    ['inactive', 'neutral'],
    ['processing', 'info'],
    ['shipped', 'info'],
    ['backorder', 'info'],
    ['partial', 'info'],
    ['delivered', 'success-solid'],
    ['completed', 'success-solid'],
    ['on-hold', 'warning'],
    ['cancelled', 'destructive-soft'],
  ])('gives %s the %s tone', (status, variant) => {
    expect(getOrderStatusVariant(status)).toBe(variant);
  });

  it('has a tone for every known status', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_VARIANT[status], status).toEqual(expect.any(String));
    }
  });

  it('matches the status case-insensitively', () => {
    expect(getOrderStatusVariant('Cancelled')).toBe('destructive-soft');
    expect(getOrderStatusVariant('ON-HOLD')).toBe('warning');
  });

  it('gives an unknown or missing status the neutral tone', () => {
    expect(getOrderStatusVariant('ready-for-pickup')).toBe('neutral');
    expect(getOrderStatusVariant(undefined)).toBe('neutral');
    expect(getOrderStatusVariant(null)).toBe('neutral');
    expect(getOrderStatusVariant('')).toBe('neutral');
  });

  it('does not read a status from the object prototype', () => {
    expect(getOrderStatusVariant('constructor')).toBe('neutral');
    expect(getOrderStatusVariant('toString')).toBe('neutral');
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
