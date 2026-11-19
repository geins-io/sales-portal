import { describe, it, expect } from 'vitest';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  UpdateProfileSchema,
  ChangePasswordSchema,
  ListOrdersSchema,
} from '../../../server/schemas/api-input';

describe('ForgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = ForgotPasswordSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = ForgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts valid resetKey and password', () => {
    const result = ResetPasswordSchema.safeParse({
      resetKey: 'abc123',
      password: 'newpass88',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing resetKey', () => {
    const result = ResetPasswordSchema.safeParse({ password: 'newpass88' });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = ResetPasswordSchema.safeParse({
      resetKey: 'abc123',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = ResetPasswordSchema.safeParse({
      resetKey: 'abc123',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateProfileSchema', () => {
  it('accepts valid address fields', () => {
    const result = UpdateProfileSchema.safeParse({
      address: { firstName: 'John', lastName: 'Doe', city: 'Stockholm' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no changes)', () => {
    const result = UpdateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts newsletter boolean', () => {
    const result = UpdateProfileSchema.safeParse({ newsletter: true });
    expect(result.success).toBe(true);
  });

  it('rejects firstName longer than 100 chars', () => {
    const result = UpdateProfileSchema.safeParse({
      address: { firstName: 'a'.repeat(101) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string address fields', () => {
    const result = UpdateProfileSchema.safeParse({
      address: { firstName: 123 },
    });
    expect(result.success).toBe(false);
  });
});

describe('ChangePasswordSchema', () => {
  it('accepts valid passwords', () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty currentPassword', () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'newpass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects newPassword shorter than 8 chars', () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = ChangePasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ListOrdersSchema: one page of the order list
// ---------------------------------------------------------------------------
describe('ListOrdersSchema', () => {
  it("reads nothing as the first 20 of the company's orders", () => {
    expect(ListOrdersSchema.parse({})).toEqual({
      mine: false,
      skip: 0,
      take: 20,
    });
  });

  it('reads the query as h3 hands it over, strings', () => {
    expect(
      ListOrdersSchema.parse({
        skip: '20',
        take: '100',
        search: '1213',
        mine: 'true',
      }),
    ).toEqual({ mine: true, skip: 20, take: 100, search: '1213' });
  });

  it.each(['false', '0'])('reads mine=%s as the company', (mine) => {
    expect(ListOrdersSchema.parse({ mine }).mine).toBe(false);
  });

  it.each(['1', 'yes'])('reads mine=%s as the buyer', (mine) => {
    expect(ListOrdersSchema.parse({ mine }).mine).toBe(true);
  });

  it('refuses a mine that is not a yes or a no', () => {
    expect(ListOrdersSchema.safeParse({ mine: 'maybe' }).success).toBe(false);
  });

  // Geins answers these with an error, measured on both roots.
  it.each([
    ['a negative skip', { skip: '-1' }],
    ['a fractional skip', { skip: '1.5' }],
    ['a take of 0', { take: '0' }],
    ['a take above 100', { take: '101' }],
    ['a fractional take', { take: '2.5' }],
  ])('refuses %s', (_label, query) => {
    expect(ListOrdersSchema.safeParse(query).success).toBe(false);
  });

  it('takes a take of 1 and of 100', () => {
    expect(ListOrdersSchema.parse({ take: '1' }).take).toBe(1);
    expect(ListOrdersSchema.parse({ take: '100' }).take).toBe(100);
  });

  it('trims the search, as Geins does', () => {
    expect(ListOrdersSchema.parse({ search: '  1213 ' }).search).toBe('1213');
  });

  it.each(['', '   '])('reads the blank search %j as no search', (search) => {
    expect(ListOrdersSchema.parse({ search })).not.toHaveProperty('search');
  });

  it('takes a search of 50 characters and refuses 51', () => {
    expect(ListOrdersSchema.safeParse({ search: '1'.repeat(50) }).success).toBe(
      true,
    );
    expect(ListOrdersSchema.safeParse({ search: '1'.repeat(51) }).success).toBe(
      false,
    );
  });
});
